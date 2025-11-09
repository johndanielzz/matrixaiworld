// ===== CONFIG =====
const OPENAI_API_KEY = "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";

let trialsLeft = parseInt(localStorage.getItem("trialsLeft")) || 5;
let dailyStreak = parseInt(localStorage.getItem("dailyStreak")) || 3;
let totalMsgs = 0;
let responseTimes = [];
let currentTheme = localStorage.getItem("theme") || "dark";

// ===== INIT UI =====
document.body.className = currentTheme;
document.getElementById("trialCount").textContent = trialsLeft;
document.getElementById("dailyStreak").textContent = `🔥 ${dailyStreak}-Day Streak`;

// ===== TAB SWITCHING =====
document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.target).classList.add("active");
    });
});

// ===== TOASTS =====
function showToast(msg, duration = 3000) {
    const banner = document.getElementById("announcementBanner");
    banner.textContent = msg;
    banner.style.display = "block";
    setTimeout(() => banner.style.display = "none", duration);
}

// ===== THEME TOGGLE =====
function toggleTheme() {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    document.body.className = currentTheme;
    localStorage.setItem("theme", currentTheme);
}
document.body.addEventListener("dblclick", toggleTheme);

// ===== CHAT =====
async function sendChatMessage(message) {
    if (!message) return;

    const chatBox = document.getElementById("chatBox");
    const timestamp = new Date().toLocaleTimeString();

    // User message
    const userMsg = document.createElement("div");
    userMsg.className = "user-msg";
    userMsg.innerHTML = `<span>${timestamp}</span> ${message}`;
    chatBox.appendChild(userMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    // AI placeholder
    const aiMsg = document.createElement("div");
    aiMsg.className = "ai-msg";
    aiMsg.textContent = "Typing...";
    chatBox.appendChild(aiMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    const startTime = Date.now();
    try {
        const res = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({ model: "gpt-4.1-mini", input: message })
        });
        const data = await res.json();
        let aiText = data?.output?.[0]?.content?.map(c => c.text).join("") || "⚠️ No response from AI";

        // Simulate typing
        await typeText(aiMsg, aiText);

        // Update stats
        const endTime = Date.now();
        responseTimes.push((endTime - startTime) / 1000);
        document.getElementById("avgResp").textContent = `${(responseTimes.reduce((a,b)=>a+b,0)/responseTimes.length).toFixed(2)}s`;
        totalMsgs++;
        document.getElementById("totalMsgs").textContent = totalMsgs;

        updateMoodTrend(aiText);
        saveMemory("Chat", message, aiText);

    } catch (err) {
        aiMsg.textContent = "⚠️ Error contacting AI";
        console.error(err);
    }
}

// Typing effect
async function typeText(element, text, speed = 20) {
    element.textContent = "";
    for (let char of text) {
        element.textContent += char;
        await new Promise(r => setTimeout(r, speed));
    }
}

// Mood Trend
function updateMoodTrend(text) {
    const positive = ["great", "awesome", "fantastic", "good", "happy"];
    const negative = ["bad", "sad", "angry", "upset"];
    let score = 0;
    positive.forEach(w => { if (text.toLowerCase().includes(w)) score++; });
    negative.forEach(w => { if (text.toLowerCase().includes(w)) score--; });
    const mood = score > 0 ? "Positive" : score < 0 ? "Negative" : "Neutral";
    document.getElementById("moodTrend").textContent = mood;
}

// Send button & Enter
document.getElementById("sendBtn")?.addEventListener("click", () => {
    const input = document.getElementById("userInput");
    sendChatMessage(input.value);
    input.value = "";
});
document.getElementById("userInput")?.addEventListener("keypress", e => {
    if (e.key === "Enter") {
        sendChatMessage(e.target.value);
        e.target.value = "";
    }
});

// ===== VOICE INPUT =====
document.getElementById("voiceBtn")?.addEventListener("click", () => {
    if (!('webkitSpeechRecognition' in window)) return showToast("Voice recognition not supported!");
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onresult = e => {
        const transcript = e.results[0][0].transcript;
        document.getElementById("userInput").value = transcript;
        sendChatMessage(transcript);
    };
    recognition.start();
});

// ===== IMAGE GENERATION =====
document.getElementById("generateImageBtn")?.addEventListener("click", async () => {
    const prompt = document.getElementById("imagePrompt").value.trim();
    const style = document.getElementById("imageStyle").value;
    const size = document.getElementById("imageSize").value;
    const resultDiv = document.getElementById("imageResult");
    if (!prompt) return showToast("Enter image description!");

    resultDiv.innerHTML = "Generating image...";
    try {
        const res = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({ model: "gpt-image-1", prompt: `${prompt}, style: ${style}`, size })
        });
        const data = await res.json();
        if (data?.data?.length) {
            resultDiv.innerHTML = data.data.map(img => `<img src="${img.url}" alt="Generated Image">`).join("");
        } else resultDiv.textContent = "⚠️ Failed to generate image";

        saveMemory("Image Generation", prompt, `Style: ${style}, Size: ${size}`);
    } catch (err) {
        console.error(err);
        resultDiv.textContent = "⚠️ Error generating image";
    }
});

// ===== TOOLS =====
const tools = [
    {btn:"summarizeBtn", input:"sumInput", output:"sumOutput", prompt: txt=>`Summarize in 3 sentences:\n${txt}`, name:"Summarizer"},
    {btn:"generateCodeBtn", input:"codePrompt", output:"codeOutput", prompt: txt=>`Write code for: ${txt}`, name:"Code Generator"},
    {btn:"translateBtn", input:"translateInput", output:"translateOutput", prompt: txt=>`Translate to ${document.getElementById("languageSelect").value}: ${txt}`, name:"Translator"},
    {btn:"tweetBtn", input:"tweetInput", output:"tweetOutput", prompt: txt=>`Write a viral tweet about: ${txt}`, name:"Viral Tweet Generator"},
    {btn:"memeBtn", input:"memeInput", output:"memeOutput", prompt: txt=>`Write a funny meme caption for: ${txt}`, name:"Meme Caption Generator"},
    {btn:"viralBtn", input:"viralInput", output:"viralOutput", prompt: txt=>`Create a viral social media strategy for: ${txt}`, name:"Viral Strategy Planner"}
];

tools.forEach(tool => {
    document.getElementById(tool.btn)?.addEventListener("click", async () => {
        const val = document.getElementById(tool.input).value.trim();
        if (!val) return showToast(`Enter input for ${tool.name}`);
        const out = document.getElementById(tool.output);
        out.textContent = "Processing...";
        const response = await callOpenAI({ model:"gpt-4.1-mini", input: tool.prompt(val) });
        out.textContent = response;
        saveMemory(tool.name, val, response);
    });
});

// ===== OPENAI CALL =====
async function callOpenAI(payload) {
    try {
        const res = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        return data?.output?.[0]?.content?.map(c => c.text).join("") || "⚠️ No response from AI";
    } catch (err) {
        console.error(err);
        return "⚠️ Error contacting AI";
    }
}

// ===== MEMORY =====
function saveMemory(tool, input, output) {
    const savedChats = document.getElementById("savedChats");
    const li = document.createElement("li");
    li.innerHTML = `<strong>${tool}</strong> | <em>${new Date().toLocaleString()}</em><br><em>Input:</em> ${input}<br><em>Output:</em> ${output}`;
    savedChats.prepend(li);
}

// ===== LOGOUT =====
document.getElementById("logoutBtn")?.addEventListener("click", () => {
    showToast("Logged out successfully!");
    setTimeout(() => window.location.href = "login.html", 1000);
});
// =======================
// PayPal v6 Integration
// =======================

async function onPayPalWebSdkLoaded() {
  try {
    // 1. Get client token from server
    const clientToken = await getBrowserSafeClientToken();

    // 2. Create PayPal SDK instance
    const sdkInstance = await window.paypal.createInstance({
      clientToken,
      components: ["paypal-payments"],
      pageType: "checkout",
    });

    // 3. Check eligibility for all payment methods
    const paymentMethods = await sdkInstance.findEligibleMethods({ currencyCode: "USD" });

    if (paymentMethods.isEligible("paypal")) setUpPayPalButton(sdkInstance);
    if (paymentMethods.isEligible("paylater")) setUpPayLaterButton(sdkInstance, paymentMethods.getDetails("paylater"));
    if (paymentMethods.isEligible("credit")) setUpPayPalCreditButton(sdkInstance, paymentMethods.getDetails("credit"));
    
  } catch (error) {
    console.error("PayPal SDK initialization error:", error);
  }
}

// Shared session callbacks
const paymentSessionOptions = {
  async onApprove(data) {
    try {
      const orderData = await captureOrder({ orderId: data.orderId });
      console.log("Payment captured successfully:", orderData);
    } catch (err) {
      console.error("Payment capture failed:", err);
    }
  },
  onCancel(data) {
    console.log("Payment cancelled:", data);
  },
  onError(error) {
    console.error("Payment error:", error);
  },
};

// -------------------
// Button Setup
// -------------------

async function setUpPayPalButton(sdkInstance) {
  const session = sdkInstance.createPayPalOneTimePaymentSession(paymentSessionOptions);
  const button = document.querySelector("paypal-button");
  button.removeAttribute("hidden");

  button.addEventListener("click", async () => {
    try { await session.start({ presentationMode: "auto" }, createOrder()); }
    catch (err) { console.error("PayPal button start error:", err); }
  });
}

async function setUpPayLaterButton(sdkInstance, details) {
  const session = sdkInstance.createPayLaterOneTimePaymentSession(paymentSessionOptions);
  const button = document.querySelector("paypal-pay-later-button");

  button.productCode = details.productCode;
  button.countryCode = details.countryCode;
  button.removeAttribute("hidden");

  button.addEventListener("click", async () => {
    try { await session.start({ presentationMode: "auto" }, createOrder()); }
    catch (err) { console.error("Pay Later start error:", err); }
  });
}

async function setUpPayPalCreditButton(sdkInstance, details) {
  const session = sdkInstance.createPayPalCreditOneTimePaymentSession(paymentSessionOptions);
  const button = document.querySelector("paypal-credit-button");

  button.countryCode = details.countryCode;
  button.removeAttribute("hidden");

  button.addEventListener("click", async () => {
    try { await session.start({ presentationMode: "auto" }, createOrder()); }
    catch (err) { console.error("PayPal Credit start error:", err); }
  });
}

// -------------------
// API Calls
// -------------------

// Fetch client token from backend
async function getBrowserSafeClientToken() {
  const response = await fetch("/paypal-api/auth/browser-safe-client-token");
  const { accessToken } = await response.json();
  return accessToken;
}

// Create an order
async function createOrder() {
  const response = await fetch("/paypal-api/checkout/orders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cart: [
        { id: "YOUR_PRODUCT_ID_1", quantity: 1 },
        { id: "YOUR_PRODUCT_ID_2", quantity: 2 },
      ],
    }),
  });

  const { id } = await response.json();
  return { orderId: id };
}

// Capture an order
async function captureOrder({ orderId }) {
  const response = await fetch(`/paypal-api/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  return await response.json();
}

// =======================
// Initialize when SDK loads
// =======================
window.onPayPalWebSdkLoaded = onPayPalWebSdkLoaded;

// Main JS upgrades

// 1. Payment Buttons with Tooltip and Countdown
const paymentButtons = document.querySelectorAll('.payment-btn');
const promoInput = document.querySelector('.promo-input');
const promoMessage = document.getElementById('promo-message');

// Example promo codes
const promoCodes = { "MATRIX10": 0.1, "MATRIX20": 0.2 };

promoInput.addEventListener('input', () => {
    const code = promoInput.value.toUpperCase();
    if(promoCodes[code]){
        promoMessage.textContent = `Promo applied! ${promoCodes[code]*100}% off`;
    } else {
        promoMessage.textContent = '';
    }
});

// Countdown timer example (7 days)
function startCountdown(endDate, container) {
    function update() {
        const now = new Date();
        const distance = endDate - now;
        if(distance <= 0) {
            container.textContent = "Discount expired!";
            return;
        }
        const days = Math.floor(distance/(1000*60*60*24));
        const hours = Math.floor((distance%(1000*60*60*24))/(1000*60*60));
        const minutes = Math.floor((distance%(1000*60*60))/(1000*60));
        const seconds = Math.floor((distance%(1000*60))/1000);
        container.textContent = `Hurry! ${days}d ${hours}h ${minutes}m ${seconds}s left for discount!`;
    }
    update();
    setInterval(update,1000);
}

// Add countdown to all plans
document.querySelectorAll('.payment-option').forEach(plan => {
    const countdown = document.createElement('div');
    countdown.classList.add('countdown');
    plan.prepend(countdown);
    const end = new Date();
    end.setDate(end.getDate()+7);
    startCountdown(end,countdown);
});

// Payment button handling
paymentButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const option = e.target.closest('.payment-option');
        let amount = parseFloat(option.dataset.amount);
        const plan = option.dataset.plan;
        const gateway = e.target.dataset.gateway;

        // Apply promo discount
        const code = promoInput.value.toUpperCase();
        if(promoCodes[code]){
            amount = (amount * (1 - promoCodes[code])).toFixed(2);
        }

        if(gateway === 'paypal'){
            paypal.Buttons({
                style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
                createOrder: (data, actions) => actions.order.create({
                    purchase_units: [{ amount: { value: amount }, description: `${plan} Plan - MatrixAI` }]
                }),
                onApprove: (data, actions) => actions.order.capture().then(() => {
                    showSuccessModal();
                }),
                onError: (err) => { console.error(err); alert('PayPal payment failed.'); }
            }).render(e.target.parentElement);
            e.target.style.display = 'none';
        }

        if(gateway === 'stripe'){
            const stripe = Stripe('YOUR_STRIPE_PUBLISHABLE_KEY');
            const session = await fetch('/create-stripe-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, plan })
            }).then(res => res.json());
            const { error } = await stripe.redirectToCheckout({ sessionId: session.id });
            if(error) alert(error.message);
        }
    });
});

// Success Modal with Confetti
function showSuccessModal(){
    const modal = document.getElementById('successModal');
    modal.style.display = 'flex';
    // Confetti
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
}

// Dark/Light Mode toggle
function toggleTheme(){
    if(document.body.style.background==='white'){
        document.body.style.background='#121212';
        document.body.style.color='#f0f0f0';
    } else {
        document.body.style.background='white';
        document.body.style.color='black';
    }
}
/* =======================================================
   MatrixAI — main.js
   Handles: Payment, Theme, Countdown, and Modals
   ======================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initCountdown();
  initThemeToggle();
  initPayments();
});

/* -------------------- COUNTDOWN TIMER -------------------- */
function initCountdown() {
  const countdownEl = document.getElementById("countdown");
  if (!countdownEl) return;

  let timer = 24 * 60 * 60; // 24 hours
  setInterval(() => {
    const h = String(Math.floor(timer / 3600)).padStart(2, "0");
    const m = String(Math.floor((timer % 3600) / 60)).padStart(2, "0");
    const s = String(timer % 60).padStart(2, "0");
    countdownEl.textContent = `Limited offer ends in ${h}:${m}:${s}`;
    timer--;
  }, 1000);
}

/* -------------------- THEME TOGGLE -------------------- */
function initThemeToggle() {
  const toggleBtn = document.querySelector(".theme-toggle");
  if (!toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-mode");
    document.body.style.background = isLight ? "white" : "#121212";
    document.body.style.color = isLight ? "black" : "#f0f0f0";
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });

  // Auto-apply saved theme
  const saved = localStorage.getItem("theme");
  if (saved === "light") {
    document.body.classList.add("light-mode");
    document.body.style.background = "white";
    document.body.style.color = "black";
  }
}

/* -------------------- MODAL CONTROL -------------------- */
function showModal(title, message) {
  const modal = document.getElementById("successModal");
  if (!modal) return;
  modal.querySelector("h3").textContent = title;
  modal.querySelector("p").textContent = message;
  modal.style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("successModal");
  if (modal) modal.style.display = "none";
}

/* -------------------- PAYMENT SYSTEM -------------------- */
function initPayments() {
  const paymentButtons = document.querySelectorAll(".payment-btn");
  if (!paymentButtons.length) return;

  paymentButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const card = e.target.closest(".payment-option");
      let amount = parseFloat(card.dataset.amount);
      const plan = card.dataset.plan;
      const gateway = e.target.dataset.gateway;
      const promo = document.getElementById("promoCode")?.value.trim();

      // Apply promo
      if (promo === "MATRIX50") {
        amount = (amount / 2).toFixed(2);
        alert("✅ Promo Applied: 50% OFF!");
      }

      // Payment route
      if (gateway === "paypal") return handlePayPal(e.target, plan, amount);
      if (gateway === "stripe") return handleStripe(plan, amount);
    });
  });
}

/* -------------------- PAYPAL LOGIC -------------------- */
function handlePayPal(button, plan, amount) {
  // Render PayPal button dynamically (only once)
  if (button.dataset.rendered) return;
  button.dataset.rendered = true;

  paypal
    .Buttons({
      style: {
        color: "gold",
        shape: "pill",
        layout: "vertical",
      },
      createOrder: (data, actions) =>
        actions.order.create({
          purchase_units: [
            {
              amount: { value: amount },
              description: `${plan} Plan - MatrixAI`,
            },
          ],
        }),
      onApprove: (data, actions) => {
        showModal("✅ Payment Successful!", `Welcome to MatrixAI ${plan}!`);
        console.log("Payment Approved:", data);
      },
      onError: (err) => alert("❌ PayPal Error: " + err.message),
    })
    .render(button.parentElement);

  button.style.display = "none";
}

/* -------------------- STRIPE LOGIC -------------------- */
async function handleStripe(plan, amount) {
  const stripe = Stripe("YOUR_STRIPE_PUBLISHABLE_KEY"); // replace with your key
  try {
    const res = await fetch("/create-stripe-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, amount }),
    });

    const session = await res.json();
    if (session?.id) {
      const { error } = await stripe.redirectToCheckout({
        sessionId: session.id,
      });
      if (error) alert(error.message);
    } else {
      alert("❌ Stripe session creation failed.");
    }
  } catch (err) {
    console.error(err);
    alert("⚠️ Stripe payment failed. Check server connection.");
  }
}
/* =======================================================
   MatrixAI — PayPal Payment System (Only)
   Supports: One-time + Subscription, Promo, Countdown
   ======================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initCountdown();
  initThemeToggle();
  initPayPalPayments();
});

/* -------------------- COUNTDOWN -------------------- */
function initCountdown() {
  const countdownEl = document.getElementById("countdown");
  if (!countdownEl) return;

  let timer = 3 * 24 * 60 * 60; // 3 days offer
  setInterval(() => {
    if (timer <= 0) {
      countdownEl.textContent = "⚠️ Offer expired!";
      return;
    }
    const d = Math.floor(timer / (60 * 60 * 24));
    const h = Math.floor((timer % (60 * 60 * 24)) / 3600);
    const m = Math.floor((timer % 3600) / 60);
    const s = timer % 60;
    countdownEl.textContent = `🔥 Special Offer ends in ${d}d ${h}h ${m}m ${s}s`;
    timer--;
  }, 1000);
}

/* -------------------- THEME TOGGLE -------------------- */
function initThemeToggle() {
  const toggleBtn = document.querySelector(".theme-toggle");
  if (!toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    document.body.style.background = isLight ? "#fff" : "#121212";
    document.body.style.color = isLight ? "#000" : "#f0f0f0";
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });

  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
    document.body.style.background = "#fff";
    document.body.style.color = "#000";
  }
}

/* -------------------- SUCCESS MODAL -------------------- */
function showModal(title, message) {
  const modal = document.getElementById("successModal");
  if (!modal) return;
  modal.querySelector("h3").textContent = title;
  modal.querySelector("p").textContent = message;
  modal.style.display = "flex";
}

/* -------------------- PAYPAL PAYMENT -------------------- */
function initPayPalPayments() {
  const buttons = document.querySelectorAll(".payment-btn");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const card = e.target.closest(".payment-option");
      const plan = card.dataset.plan;
      const amount = card.dataset.amount;
      const type = card.dataset.type; // "one-time" or "subscription"
      const promoCode = document.getElementById("promoCode")?.value.trim().toUpperCase();

      let finalAmount = parseFloat(amount);

      // Promo codes
      const promoList = { "MATRIX10": 0.9, "MATRIX25": 0.75, "MATRIX50": 0.5 };
      if (promoCode && promoList[promoCode]) {
        finalAmount = (finalAmount * promoList[promoCode]).toFixed(2);
        alert(`✅ Promo Applied: ${((1 - promoList[promoCode]) * 100)}% OFF`);
      }

      if (type === "subscription") {
        setupPayPalSubscription(plan);
      } else {
        setupPayPalOneTime(plan, finalAmount);
      }
    });
  });
}

/* -------- One-time Payments -------- */
function setupPayPalOneTime(plan, amount) {
  const container = document.getElementById(`paypal-${plan}`);
  if (!container || container.dataset.rendered) return;
  container.dataset.rendered = true;

  paypal
    .Buttons({
      style: { color: "gold", shape: "pill", layout: "vertical", label: "paypal" },
      createOrder: (data, actions) =>
        actions.order.create({
          purchase_units: [
            {
              amount: { value: amount },
              description: `${plan} Plan - MatrixAI`,
            },
          ],
        }),
      onApprove: async (data, actions) => {
        await actions.order.capture();
        showModal("✅ Payment Successful!", `Welcome to MatrixAI ${plan} Plan!`);
      },
      onError: (err) => {
        console.error("PayPal Error:", err);
        alert("❌ Payment failed. Please try again.");
      },
    })
    .render(container);
}

/* -------- Subscription Payments -------- */
function setupPayPalSubscription(plan) {
  const container = document.getElementById(`paypal-${plan}`);
  if (!container || container.dataset.rendered) return;
  container.dataset.rendered = true;

  paypal
    .Buttons({
      style: { color: "blue", shape: "pill", label: "subscribe" },
      createSubscription: (data, actions) => {
        return actions.subscription.create({
          plan_id: getPayPalPlanId(plan),
        });
      },
      onApprove: (data, actions) => {
        showModal("🎉 Subscription Activated!", `You’re now subscribed to ${plan}!`);
      },
      onError: (err) => {
        console.error("PayPal Subscription Error:", err);
        alert("⚠️ Subscription setup failed.");
      },
    })
    .render(container);
}

/* -------- PayPal Plan IDs (replace with your own) -------- */
function getPayPalPlanId(plan) {
  const plans = {
    basic: "P-XXXXXXXXXXXX_BASIC",
    pro: "P-XXXXXXXXXXXX_PRO",
    premium: "P-XXXXXXXXXXXX_PREMIUM",
  };
  return plans[plan.toLowerCase()] || plans.basic;
}

