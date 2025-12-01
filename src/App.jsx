import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Chess } from "chess.js";
import ABI from "./abi.json"; 

const CONTRACT_ADDRESS = "0x736AFc26650EF930CC6e2861769322947fb30FCd"; 
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

function App() {
  const [pgnInput, setPgnInput] = useState("");
  const [history, setHistory] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => { fetchHistory(); }, []);

  // IPFS 데이터를 가져오는 함수
  const fetchIPFSMetadata = async (cid) => {
    try {
      const res = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
      const data = await res.json();
      return data;
    } catch (e) {
      console.error("IPFS Load Error:", e);
      return { white: "?", black: "?", result: "?" };
    }
  };

  const fetchHistory = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const count = await contract.getVerificationCount();
      
      const records = [];
      // 최신 5개만 로딩
      const loadCount = Number(count) > 10 ? 10 : Number(count);
      
      for (let i = Number(count) - 1; i >= Number(count) - loadCount; i--) {
        const item = await contract.history(i);
        
        // 핵심: 블록체인에는 CID만 있지만, 여기서 IPFS 내용을 가져옴
        const metadata = await fetchIPFSMetadata(item.ipfsCid);
        
        records.push({
          ...item,
          ...metadata
        });
      }
      setHistory(records);
    } catch (e) { console.log("로딩 중", e); }
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
        alert(`지갑 연결 성공\n주소: ${importedWallet.address}`);
      } catch (err) { alert("유효하지 않은 키 파일입니다."); }
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
    if (!response.ok) throw new Error("IPFS 업로드 실패");
    return result.ipfsHash;
  };

  const verifyAndSave = async () => {
    if (!wallet) return alert("먼저 키 파일을 업로드해주세요.");
    setLoading(true);
    
    try {
      setStatusMsg("기보 분석 중");
      const chess = new Chess();
      chess.loadPgn(pgnInput);
      const header = chess.header();
      
      // PGN 헤더에서 정보 추출
      const whiteName = header['White'] || "Unknown Player";
      const blackName = header['Black'] || "Unknown Player";
      const gameResult = header['Result'] || "Unknown";

      let verdict = "Human Verified";
      if (header['WhiteType'] === 'Program') verdict = "AI Suspected";
      if (chess.history().length < 20 && header['Result'] !== '1/2-1/2') verdict = "AI Suspected (Too Fast)";

      // IPFS에 상세 정보 포함하여 저장
      setStatusMsg("기보 저장 중");
      const ipfsData = {
        verdict, 
        pgn: pgnInput, 
        white: whiteName, 
        black: blackName, 
        result: gameResult,
        timestamp: Date.now(), 
        verifier: wallet.address
      };
      
      const cid = await uploadToIPFS(ipfsData);

      // 블록체인에는 기존처럼 CID만 저장
      setStatusMsg("기보 등록 중");
      const contractWithSigner = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
      
      const tx = await contractWithSigner.recordVerification(verdict, cid);
      await tx.wait();

      alert("저장 완료");
      setPgnInput("");
      setStatusMsg("");
      fetchHistory();
    } catch (e) {
      console.error(e);
      alert("오류 발생: " + e.message);
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  };

  // --- UI 디자인 ---
  const styles = {
    container: {
      maxWidth: "800px", margin: "0 auto", padding: "40px 20px",
      fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      color: "#333", backgroundColor: "#f4f6f8", minHeight: "100vh"
    },
    header: { textAlign: "center", marginBottom: "40px" },
    title: { fontSize: "2.5rem", color: "#2c3e50", margin: "0 0 10px 0" },
    subtitle: { color: "#7f8c8d", fontSize: "1.1rem" },
    card: {
      backgroundColor: "white", padding: "30px", borderRadius: "12px",
      boxShadow: "0 4px 15px rgba(0,0,0,0.05)", marginBottom: "25px"
    },
    label: { display: "block", marginBottom: "8px", fontWeight: "bold", color: "#34495e" },
    input: {
      width: "100%", padding: "12px", borderRadius: "8px",
      border: "1px solid #dfe6e9", fontSize: "16px",
      backgroundColor: "#ffffff", color: "#2d3436",
      boxSizing: "border-box", outline: "none"
    },
    textarea: {
      width: "100%", height: "150px", padding: "12px", borderRadius: "8px",
      border: "1px solid #dfe6e9", fontSize: "14px", fontFamily: "monospace",
      backgroundColor: "#ffffff", color: "#2d3436",
      boxSizing: "border-box", resize: "vertical", outline: "none"
    },
    button: {
      width: "100%", padding: "15px", borderRadius: "8px", border: "none",
      backgroundColor: "#3498db", color: "white", fontSize: "16px", fontWeight: "bold",
      cursor: "pointer", marginTop: "15px", transition: "all 0.2s",
      boxShadow: "0 4px 6px rgba(52, 152, 219, 0.2)"
    },
    buttonDisabled: { backgroundColor: "#bdc3c7", cursor: "not-allowed", boxShadow: "none" },
    status: { textAlign: "center", color: "#3498db", fontWeight: "bold", marginTop: "10px" },
    historyList: { listStyle: "none", padding: 0 },
    historyItem: {
      backgroundColor: "white", borderLeft: "5px solid #3498db",
      padding: "20px", marginBottom: "15px", borderRadius: "8px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "transform 0.2s"
    },
    vsText: { fontSize: "1.2rem", fontWeight: "bold", color: "#2c3e50", margin: "5px 0" },
    metaInfo: { fontSize: "13px", color: "#95a5a6", marginTop: "8px" },
    badge: (verdict) => ({
      display: "inline-block", padding: "4px 12px", borderRadius: "20px", 
      fontSize: "12px", fontWeight: "bold",
      backgroundColor: verdict.includes("Human") ? "#e1f7d5" : "#ffeaa7", 
      color: verdict.includes("Human") ? "#2ecc71" : "#d63031", 
      marginBottom: "8px"
    }),
    link: { color: "#3498db", textDecoration: "none", fontSize: "14px", marginLeft: "10px" }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Chess Verifier</h1>
        <p style={styles.subtitle}>Blockchain & IPFS Powered Verification</p>
      </header>

      {/* 1. 지갑 연결 */}
      <div style={styles.card}>
        <h3 style={{marginTop: 0, color: "#2c3e50"}}>1. Connect Wallet</h3>
        {!wallet ? (
          <div>
            <label style={styles.label}>Upload Private Key (.txt)</label>
            <input type="file" accept=".txt" onChange={handleFileUpload} style={styles.input} />
            <p style={{fontSize: "12px", color: "#e74c3c", marginTop: "8px"}}>
              * 0x로 시작하는 개인키 파일을 선택하세요. 서버에 저장되지 않습니다.
            </p>
          </div>
        ) : (
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <div>
              <span style={{color: "#27ae60", fontWeight: "bold", fontSize: "1.1rem"}}>Wallet Connected</span>
              <div style={{fontSize: "14px", color: "#7f8c8d", marginTop: "4px"}}>
                {wallet.address}
              </div>
            </div>
            <button 
              onClick={() => setWallet(null)} 
              style={{...styles.button, width: "auto", backgroundColor: "#e74c3c", marginTop: 0, padding: "10px 20px"}}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* 2. 검증 입력 */}
      <div style={styles.card}>
        <h3 style={{marginTop: 0, color: "#2c3e50"}}>2. Verify Game</h3>
        <label style={styles.label}>Paste PGN Code</label>
        <textarea 
          value={pgnInput}
          onChange={(e) => setPgnInput(e.target.value)}
          placeholder='[Event "World Championship"]&#10;[White "Player A"]&#10;[Black "Player B"]&#10;1. e4 e5 ...'
          style={styles.textarea}
        />
        {statusMsg && <p style={styles.status}>{statusMsg}</p>}
        <button 
          onClick={verifyAndSave} 
          disabled={loading || !wallet}
          style={loading || !wallet ? {...styles.button, ...styles.buttonDisabled} : styles.button}
        >
          {loading ? "Processing..." : "Verify & Save to Blockchain"}
        </button>
      </div>

      {/* 3. 기록 리스트 */}
      <h3 style={{color: "#2c3e50", borderLeft: "5px solid #2c3e50", paddingLeft: "15px", marginTop: "40px"}}>
        Recent Verifications
      </h3>
      <ul style={styles.historyList}>
        {history.length === 0 ? <p style={{color: "#95a5a6", fontStyle: "italic"}}>No records found yet.</p> : history.map((h, i) => (
          <li key={i} style={styles.historyItem}>
            <span style={styles.badge(h.result)}>{h.result}</span>
            
            <div style={styles.vsText}>
              White: {h.white || "Loading..."} vs Black: {h.black || "Loading..."}
            </div>
            <div style={{fontWeight: "bold", color: "#e67e22", marginBottom: "5px"}}>
              Winner: {h.result === "1/2-1/2" ? "Draw" : h.result === "1-0" ? "White" : h.result === "0-1" ? "Black" : "Unknown"}
            </div>

            <div style={{borderTop: "1px solid #f1f2f6", paddingTop: "10px", marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
              <div style={styles.metaInfo}>
                CID: {h.ipfsCid.substring(0, 10)}... <br/>
                Time: {new Date(Number(h.timestamp) * 1000).toLocaleString()}
              </div>
              <a 
                href={`https://ipfs.io/ipfs/${h.ipfsCid}`} 
                target="_blank" 
                rel="noreferrer" 
                style={styles.link}
              >
                View Details
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;