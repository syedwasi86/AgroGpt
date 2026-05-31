const axios = require('axios');

async function checkMandiData() {
    // This forces the explicit HTTPS secure route that the browser is dropping
    const endpoint = "https://api.data.gov.in/v1/resource/35985678-0d79-46b4-9ed6-6f13308a1d24";

    try {
        console.log("Connecting to Agmarknet servers...");
        const response = await axios.get(endpoint, {
            params: {
                "api-key": "579b464db66ec23bdd0000014757bae33c1e41f777acf31cab0df663",
                "format": "json",
                "limit": 3 // Just pulling 3 rows to test
            }
        });

        console.log("\n✅ SUCCESS! Data received from the government server:");
        console.log(JSON.stringify(response.data.records, null, 2));

    } catch (error) {
        console.log("\n❌ CONNECTION FAILED.");
        if (error.response) {
            console.log(`Status Code: ${error.response.status}`);
            console.log("Server Message:", error.response.data);
        } else {
            console.log("Error Details:", error.message);
        }
    }
}

checkMandiData();