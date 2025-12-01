import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Chess } from "chess.js";
import ABI from "./abi.json"; 

// 🔴 본인의 컨트랙트 주소로 변경
const CONTRACT_ADDRESS = "0x736AFc26650EF930CC6e2861769322947fb30FCd"; 
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

function App() {
  const [pgnInput, setPgnInput] = useState("");
  const [history, setHistory] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const count = await contract.getVerificationCount();
      const records = [];
      const loadCount = Number(count) > 5 ? 5 : Number(count);
      for (let i = Number(count) - 1; i >= Number(count) - loadCount; i--) {
        const item = await contract.history(i);
        records.push(item);
      }
      setHistory(records);
    } catch (e) { console.log("Loading history..."); }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const privateKey = e.target.result.trim();
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const importedWallet = new ethers.Wallet(privateKey, provider);
        setWallet(importedWallet);
        alert(`Wallet Loaded: ${importedWallet.address}`);
      } catch (err) { alert("Invalid key file."); }
    };
    reader.readAsText(file);
  };

  const uploadToIPFS = async (data) => {
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: data })
    });
    const result = await response.json();
    if (!response.ok) throw new Error("IPFS Upload Failed");
    return result.ipfsHash;
  };

  const verifyAndSave = async () => {
    if (!wallet) return alert("Please upload a key file first.");
    setLoading(true);
    
    try {
      setStatus("Analyzing PGN...");
      const chess = new Chess();
      chess.loadPgn(pgnInput);
      const header = chess.header();
      
      let verdict = "Human Verified";
      if (header['WhiteType'] === 'Program') verdict = "AI Suspected";
      if (chess.history().length < 20 && header['Result'] !== '1/2-1/2') verdict = "AI Suspected (Too Fast)";

      setStatus("Uploading to IPFS...");
      const ipfsData = {
        verdict: verdict,
        pgn: pgnInput,
        timestamp: Date.now(),
        verifier: wallet.address
      };
      const cid = await uploadToIPFS(ipfsData);

      setStatus("Saving to Blockchain...");
      const contractWithSigner = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
      const tx = await contractWithSigner.recordVerification(verdict, cid);
      await tx.wait();

      alert("Success! Saved to Blockchain.");
      setStatus("");
      setPgnInput("");
      fetchHistory();
    } catch (e) {
      console.error(e);
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1>Chess Verifier</h1>
      <p style={{color: "#666", fontSize: "14px"}}>
        Secure & Non-Custodial Verification System
      </p>

      <div style={{ background: "#f5f5f5", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
        <h3>1. Load Private Key (.txt)</h3>
        {!wallet ? (
          <input type="file" accept=".txt" onChange={handleFileUpload} />
        ) : (
          <div>
            <span style={{color: "green", fontWeight: "bold"}}>Connected: </span> 
            {wallet.address.substring(0, 6)}...
            <button onClick={() => setWallet(null)} style={{marginLeft: "10px"}}>Disconnect</button>
          </div>
        )}
      </div>

      <div>
        <h3>2. Verify & Save</h3>
        <textarea 
          value={pgnInput}
          onChange={(e) => setPgnInput(e.target.value)}
          placeholder="Paste PGN here..."
          style={{ width: "100%", height: "120px", padding: "10px" }}
        />
        <p style={{color: "blue"}}>{status}</p>
        <button 
          onClick={verifyAndSave} 
          disabled={loading || !wallet}
          style={{ marginTop: "10px", padding: "10px 20px", background: loading ? "#ccc" : "#007bff", color: "white", border: "none", cursor: "pointer" }}
        >
          {loading ? "Processing..." : "Verify & Save"}
        </button>
      </div>

      <h3 style={{marginTop: "30px"}}>Recent History</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {history.map((h, i) => (
          <li key={i} style={{ borderBottom: "1px solid #ddd", padding: "10px" }}>
            <strong>[{h.result}]</strong> 
            <a href={`https://ipfs.io/ipfs/${h.ipfsCid}`} target="_blank" rel="noreferrer" style={{marginLeft: "10px", color: "#007bff"}}>
              [View on IPFS]
            </a>
            <br/>
            <small style={{color: "#999"}}>CID: {h.ipfsCid}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;