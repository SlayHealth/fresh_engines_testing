require('dotenv').config({ path: '../backend/.env' });
const axios = require('axios');

async function main() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.error("Missing token or phone ID");
    return;
  }
  
  try {
    const resPhone = await axios.get(`https://graph.facebook.com/v22.0/${phoneId}?fields=whatsapp_business_account`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Phone ID Data with fields:", resPhone.data);
    const wabaId = resPhone.data.whatsapp_business_account.id;
    
    // Fetch Templates
    const resTemplates = await axios.get(`https://graph.facebook.com/v22.0/${wabaId}/message_templates`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log("Registered Templates:");
    resTemplates.data.data.forEach(t => {
      console.log(`- Name: ${t.name}, Status: ${t.status}, Language: ${t.language}`);
    });
  } catch (error) {
    console.error("Error fetching WABA data:", error.response ? error.response.data : error.message);
  }
}

main();
