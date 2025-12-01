export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data } = req.body;
    // 서버 환경변수에서 키를 안전하게 가져옴
    const PINATA_JWT = process.env.PINATA_JWT;

    if (!PINATA_JWT) {
      return res.status(500).json({ error: 'Server configuration error: Missing Pinata Key' });
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PINATA_JWT}`
      },
      body: JSON.stringify({
        pinataContent: data,
        pinataMetadata: { name: "ChessVerification.json" }
      })
    });

    const result = await response.json();
    return res.status(200).json({ ipfsHash: result.IpfsHash });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Upload failed' });
  }
}