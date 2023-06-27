import { useState } from 'react';
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import ABI from './ABI.json';
import Notification from './Notification';
import Market from './Market';
import logo from './images/pubs-market-high-resolution-logo-black-on-transparent-background.png';

function App() {

  const [connected, setConnected] = useState(false);
  const [_provider, setProvider] = useState(null);
  const [_signer, setSigner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(null);
  const [notification, setNotification] = useState({ message: '', show: false });
  const [contract, setContract] = useState(null);
  const [mintedNft, setMintedNft] = useState(null);
  const [showMarket, setShowMarket] = useState(false);

  const contractAddress = '0x4C821e42E75D9432e322975A6Fd10EE735d2E8F9';
  const MY_GIPHY_API_KEY = process.env.REACT_APP_GIPHY_API_KEY;

  const connect = async () => {
    setLoading(true);
    try {
      let provider;
      if (window.ethereum == null) {
        console.log("MetaMask not installed");
        provider = ethers.getDefaultProvider();
        console.log(provider)
      } else {
        provider = new ethers.BrowserProvider(window.ethereum)

        const network = await provider.getNetwork();
        const desiredChainId = '0x14A33';
        if (network.chainId !== parseInt(desiredChainId, 16)) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: desiredChainId }],
            });
          } catch (switchError) {
            if (switchError.code === 4902) {
              try {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: desiredChainId,
                    chainName: 'Base Goerli',
                    nativeCurrency: {
                      name: 'ETH',
                      symbol: 'ETH',
                      decimals: 18
                    },
                    rpcUrls: ['https://goerli.base.org'],
                    blockExplorerUrls: ['https://goerli.basescan.org'],
                  }],
                });
              } catch (addError) {
                throw addError;
              }
            } else {
              throw switchError;
            }
          }
        }
        provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(provider);
        const signer = await provider.getSigner();
        setSigner(signer);
        const _contract = new ethers.Contract(contractAddress, ABI, signer);
        const message = "hello world!";
        const sig = await signer.signMessage(message);
        const address = await signer.getAddress();
        const balance = await provider.getBalance(address);
        const parsed = ethers.formatEther(balance);
        console.log(parsed);
        const verify = ethers.verifyMessage(message, sig);
        console.log(verify);
        setConnected(true);
        setContract(_contract);
        const { ethereum } = window;
        if (ethereum) {
          const ensProvider = new ethers.InfuraProvider('mainnet');
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          const displayAddress = address?.substr(0, 6) + "...";
          const ens = await ensProvider.lookupAddress(address);
          if (ens !== null) {
            setName(ens)
            showNotification("Welcome " + ens);
          } else {
            setName(displayAddress)
            showNotification(displayAddress);
          }
        } else {
          alert('no wallet detected!')
        }
      }
      setLoading(false)
    } catch (error) {
      setConnected(false);
      setLoading(false);
      showNotification(error.message);
      console.log(error)
    }
  }

  async function fetchGif() {
    const url = `https://api.giphy.com/v1/gifs/random?api_key=${MY_GIPHY_API_KEY}`;

    let response = await fetch(url);
    let data = await response.json();

    if (!data.data.images || !data.data.images.original || !data.data.images.original.url) {
      throw new Error('Failed to fetch GIF from GIPHY');
    }

    let imageUrl = data.data.images.original.url;
    imageUrl = imageUrl.replace(/&/g, '&amp;');

    return imageUrl;
  }

  const mintNFT = async () => {
    if (!connected || !contract) {
      return;
    }
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const ipfsLink = await fetchGif();
      const tx = await contract.mint(address, address, ipfsLink);
      await tx.wait();
      setLoading(false);
      showNotification("Successfully minted NFT");

      // Fetch the details of the minted NFT
      const totalSupply = await contract.getTotalSupply();
      const tokenURI = await contract.tokenURI(totalSupply);
      const tokenData = JSON.parse(atob(tokenURI.split(",")[1]));
      const decodedSvg = decodeURIComponent(escape(window.atob(tokenData.image.split(",")[1])));
      console.log("Decoded SVG:", decodedSvg);
      setMintedNft(decodedSvg); // store the SVG code to state


    } catch (error) {
      setLoading(false);
      showNotification(error.message);
      console.log(error)
    }
  };


  const showNotification = (message) => {
    setNotification({ message, show: true });
  };

  const installMetamask = () => {
    window.open('https://metamask.io/download.html', '_blank');
  };

  const disconnect = () => {
    setName(null)
    setConnected(false)
  }

  return (
    <div className="app">
      <header className="header">
        <div className={`loading ${loading ? 'show' : ''}`}>
          <div className="loader"></div>
        </div>

        {typeof window.ethereum !== 'undefined' ? (
          <div className='nav'>
            {!connected && (
              <button className='connect' onClick={connect}>CONNECT</button>
            )}
            {connected && (
              <section>
                <nav>
                  <img className='logo' src={logo} alt="Pub's Market"/>
                  <button className='navBtn1' onClick={() => setShowMarket(false)}>Home</button>
                  <button className='navBtn2' onClick={() => setShowMarket(true)}>Market</button>
                  <button className='disconnect' onClick={disconnect}>{name}</button>
                </nav>

                {showMarket ?
                  <Market provider={_provider} signer={_signer} contract={contract} showNotification={showNotification} setLoading={setLoading} />
                  :
                  <div>
                    <button className='mint' onClick={mintNFT}>Mint</button>
                    {mintedNft && (
                      <div className='images' style={{ width: "200px", height: "200px" }}>
                        <div dangerouslySetInnerHTML={{ __html: mintedNft }} />
                      </div>
                    )}

                  </div>
                }
              </section>
            )}
          </div>
        ) : (
          <button onClick={installMetamask}>
            Install Metamask
          </button>
        )}

        <Notification
          message={notification.message}
          show={notification.show}
          setShow={(show) => setNotification({ ...notification, show })} />
      </header>
    </div>
  );
}

export default App;
