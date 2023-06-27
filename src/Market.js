import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import marketplaceABI from './ABIM.json';

const marketplaceAddress = "0x4fAFC381C3492D39b7F731Af90a29186c847D078";

function Marketplace({ contract, provider, signer, showNotification, setLoading }) {
    const [cards, setCards] = useState([]);
    const [selectedCard, setSelectedCard] = useState(null);
    const [price, setPrice] = useState(null);
    const [sortOption, setSortOption] = useState('priceHighToLow');

    useEffect(() => {
        if (contract) {
            loadCards();
        }
    }, [contract]);

    const sortedCards = [...cards].sort((a, b) => {
        switch (sortOption) {
            case 'priceHighToLow':
                return b.price - a.price;
            case 'priceLowToHigh':
                return a.price - b.price;
            case 'recent':
                return b.id - a.id;
            case 'id':
            default:
                return a.id - b.id;
        }
    });


    const loadCards = async () => {
        const totalSupply = await contract.getTotalSupply();

        const fetchCardData = async (id) => {
            const tokenURI = await contract.tokenURI(id);
            const tokenData = JSON.parse(atob(tokenURI.split(",")[1]));
            const decodedSvg = decodeURIComponent(escape(window.atob(tokenData.image.split(",")[1])));
            const marketplaceContract = new ethers.Contract(marketplaceAddress, marketplaceABI, signer);
            const offer = await marketplaceContract.tokenIdToOffer(id);
            const isForSale = offer.isForSale;
            const price = ethers.formatEther(offer.askingPrice);
            return {
                id,
                imageURI: tokenData.image,
                svg: decodedSvg,
                isForSale,
                price: isForSale ? parseFloat(price) : 0,  // assuming that if a card is not for sale, its price is 0
            };
        };



        const cardDataPromises = [];
        for (let i = 1; i <= totalSupply; i++) {
            cardDataPromises.push(fetchCardData(i));
        }

        const cardDataArray = await Promise.all(cardDataPromises);
        setCards(cardDataArray);
    };

    const createOffer = async (tokenId, price) => {
        const marketplaceContract = new ethers.Contract(marketplaceAddress, marketplaceABI, signer);
        const transaction = await marketplaceContract.createOffer(tokenId, ethers.parseEther(price.toString()));
        await transaction.wait();
        loadCards();
        setLoading(false)
    };

    const buyCard = async (tokenId) => {
        setLoading(true)
        const marketplaceContract = new ethers.Contract(marketplaceAddress, marketplaceABI, signer);
        const offer = await marketplaceContract.tokenIdToOffer(tokenId);
        const askingPrice = offer.askingPrice;
        const isForSale = offer.isForSale;
        if (isForSale) {
            const transaction = await marketplaceContract.buyCard(tokenId, { value: askingPrice });
            await transaction.wait();
            setLoading(false)
        } else {
            setLoading(false)
            console.log("Card is not for sale");
        }
    };


    const approveMarketplace = async (tokenId) => {
        setLoading(true)
        const approveTx = await contract.approve(marketplaceAddress, tokenId);
        return approveTx;
    };


    const selectCard = (card) => {
        console.log(card.id)
        if (selectedCard && selectedCard.id === card.id) {
            setSelectedCard(null);
        } else {
            setSelectedCard(card);
        }
    };

    return (
        <div className='marketCont'>
            <div>

                <select className='sort' defaultValue="priceHighToLow" onChange={(e) => setSortOption(e.target.value)}>
                    <option className='sortOpt' value="id">Oldest</option>
                    <option className='sortOpt' value="recent">Newest</option>
                    <option className='sortOpt' value="priceLowToHigh">Price (Low to High)</option>
                    <option className='sortOpt' value="priceHighToLow">Price (High to Low)</option>
                </select>

                <div className="token-container">
                    {sortedCards.map((card) => (
                        <div className="allImgs" key={card.id}>
                            <div
                                className='images'
                                dangerouslySetInnerHTML={{ __html: card.svg }}
                                style={{ width: "200px", height: "200px", cursor: "pointer" }}
                                onClick={() => selectCard(card)}
                            />
                            {selectedCard && selectedCard.id === card.id && (
                                <div>
                                    <input className='setPrice' onChange={(e) => setPrice(e.target.value)} placeholder="Enter price (ETH)" />
                                    <div>
                                        <button
                                            className='sellBtn'
                                            onClick={async () => {
                                                const approveTx = await approveMarketplace(card.id);
                                                await provider.waitForTransaction(approveTx.hash);
                                                await createOffer(card.id, price);
                                            }}
                                        >
                                            Sell
                                        </button>

                                        {card.isForSale && <button className='buyBtn' onClick={() => buyCard(card.id)}>Buy</button>}
                                    </div>
                                </div>
                            )}

                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Marketplace;
