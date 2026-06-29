require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');

async function main() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  
  if (!phoneNumberId || !accessToken) {
    console.error("Missing credentials");
    process.exit(1);
  }
  
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
  
  // Let's test sending with 'slay_prospect_invite' template
  const payloadInvite = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "+919289252625", // User's test phone number from logs
    type: "template",
    template: {
      name: "slay_prospect_invite",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Pranav_Test" },
            { type: "text", text: "Pranav" },
            { type: "text", text: "http://localhost:3000/invite/testtoken" }
          ]
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            { type: "text", text: "testtoken" }
          ]
        }
      ]
    }
  };

  try {
    console.log("Sending with 'slay_prospect_invite' template...");
    const res = await axios.post(url, payloadInvite, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Failed with 'slay_prospect_invite':", err.response ? err.response.data : err.message);
    
    // Now let's try with 'slay_otp_authentication' template to see if that works
    console.log("\nTrying with 'slay_otp_authentication' template...");
    const payloadOtp = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+919289252625",
      type: "template",
      template: {
        name: "slay_otp_authentication",
        language: { code: "en_US" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "123456" },
              { type: "text", text: "+91 92172 46727" }
            ]
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              { type: "text", text: "123456" }
            ]
          }
        ]
      }
    };
    
    try {
      const res = await axios.post(url, payloadOtp, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log("Success with OTP template:", res.data);
    } catch (err2) {
      console.error("Failed with OTP template:", err2.response ? err2.response.data : err2.message);
    }
  }
}

main();
