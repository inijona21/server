const express = require("express");
const cors = require("cors");
const qs = require("querystring");

const app = express();
const PORT = 3000;

// Konfigurasi OAuth 2.0
const clientID = "30b2c6211d0b49efa65151ffdc9c6a90";
const clientSecret = "9371ed8db0464638882382e16a477248";

let accessToken = null;
let tokenExpiration = 0; // Waktu kadaluwarsa token dalam epoch time

app.use(cors());
app.use(express.json());

// Fungsi untuk mendapatkan access token baru jika sudah kadaluarsa
// Fungsi untuk mendapatkan access token baru jika sudah kadaluarsa
async function getAccessToken() {
    const currentTime = Math.floor(Date.now() / 1000); // Waktu sekarang dalam detik
    if (accessToken && currentTime < tokenExpiration) {
        return accessToken; // Gunakan token yang masih berlaku
    }

    const tokenUrl = "https://oauth.fatsecret.com/connect/token"; // ✅ Perbaikan target URL
    const credentials = Buffer.from(`${clientID}:${clientSecret}`).toString("base64");

    const response = await fetch(tokenUrl, { // ✅ Gunakan `tokenUrl`, bukan `targetUrl`
        method: "POST",
        headers: {
            "Authorization": `Basic ${credentials}`, // ✅ Perbaikan penggunaan token
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: qs.stringify({
            grant_type: "client_credentials",
            scope: "basic"
        })
    });

    const data = await response.json();
    if (data.access_token) {
        accessToken = data.access_token;
        tokenExpiration = Math.floor(Date.now() / 1000) + data.expires_in; // Simpan waktu kadaluarsa token
        console.log("New Access Token Retrieved:", accessToken);
    } else {
        throw new Error("Failed to obtain access token");
    }

    return accessToken;
}


app.all("/proxy/*", async (req, res) => {
    try {
        const token = await getAccessToken();  // Dapatkan access token
        const targetUrl = "https://platform.fatsecret.com/rest/server.api"; // ✅ Pastikan targetUrl ada

        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: qs.stringify({
                ...req.body,  // Data dari request client
                format: "json" // Paksa API mengembalikan JSON
            })
        });

        const textData = await response.text(); // Ambil response sebagai teks

        // Cek jika response adalah XML
        if (textData.startsWith("<?xml")) {
            return res.status(500).json({ error: "API returned XML response", details: textData });
        }

        const data = JSON.parse(textData);
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ error: "Proxy error", details: error.message });
    }
});

app.get("/search-foods", async (req, res) => {
    try {
        const token = await getAccessToken();  // Dapatkan access token
        const { search_expression, page_number = 0, max_results = 10 } = req.query; // Ambil parameter dari query

        if (!search_expression) {
            return res.status(400).json({ error: "search_expression parameter is required" });
        }

        const targetUrl = "https://platform.fatsecret.com/rest/server.api";

        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: qs.stringify({
                method: "foods.search",
                search_expression,
                format: "json",
                page_number,
                max_results
            })
        });

        const textData = await response.text();

        // Cek jika response adalah XML
        if (textData.startsWith("<?xml")) {
            return res.status(500).json({ error: "API returned XML response", details: textData });
        }

        const data = JSON.parse(textData);
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ error: "Proxy error", details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
