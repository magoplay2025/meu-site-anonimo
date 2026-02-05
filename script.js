// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBs2Vqqbbmu_ECEs6s3kSGBkMyGioTa9n0",
    authDomain: "instagram-a97f9.firebaseapp.com",
    projectId: "instagram-a97f9",
    storageBucket: "instagram-a97f9.firebasestorage.app",
    messagingSenderId: "602945830133",
    appId: "1:602945830133:web:a6c5b69c05e4913a7e99bc",
    measurementId: "G-J4ZP5P5LDT"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- VARIÁVEIS ---
let currentUser = null;
let realTimeListener = null;

const screens = {
    login: document.getElementById('login-screen'),
    dashboard: document.getElementById('dashboard-screen'),
    public: document.getElementById('public-screen')
};

const diceQuestions = ["Qual é o seu maior segredo?", "Quem foi seu primeiro crush?", "Uma música que define sua vida?", "O que você faria com 1 milhão?"];

// --- NAVEGAÇÃO ---
function showScreen(screenName) {
    Object.values(screens).forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
    screens[screenName].classList.remove('hidden');
    screens[screenName].classList.add('active');
}

// --- LOGIN / CADASTRO ---
async function handleLogin() {
    const userInp = document.getElementById('inp-user').value.toLowerCase().replace(/\s/g, '').replace('@', '');
    const passInp = document.getElementById('inp-pass').value;

    if (!userInp || !passInp) return alert("Preencha usuário e senha.");
    if (passInp.length < 3) return alert("Senha muito curta.");

    const btn = document.querySelector('.btn-black');
    btn.innerText = "Carregando...";
    btn.disabled = true;

    try {
        const userRef = db.collection('users').doc(userInp);
        const doc = await userRef.get();

        if (doc.exists) {
            const data = doc.data();
            if (data.pin === passInp) {
                loginUser(data);
            } else {
                alert("Senha incorreta!");
            }
        } else {
            const confirmCreate = confirm(`O usuário @${userInp} não existe.\nDeseja criar agora com essa senha?`);
            if (confirmCreate) {
                const newUser = {
                    username: userInp,
                    pin: passInp,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await userRef.set(newUser);
                loginUser(newUser);
            }
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão.");
    } finally {
        btn.innerText = "ENTRAR / CRIAR";
        btn.disabled = false;
    }
}

function loginUser(userData) {
    currentUser = userData;
    localStorage.setItem('anonbox_user', JSON.stringify(userData));
    setupDashboard();
    showScreen('dashboard');
}

// --- DASHBOARD ---
function setupDashboard() {
    document.getElementById('user-name').innerText = "@" + currentUser.username;
    
    // Avatar simples (letra)
    const avatarUrl = `https://ui-avatars.com/api/?name=${currentUser.username}&background=random&color=fff&bold=true&size=200`;
    document.getElementById('user-avatar').src = avatarUrl;
    
    const baseUrl = window.location.href.split('?')[0];
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    document.getElementById('my-link').value = `${cleanUrl}?u=${currentUser.username}`;
    
    listenToMessages();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('anonbox_user');
    if (realTimeListener) realTimeListener();
    document.getElementById('inp-pass').value = ""; 
    showScreen('login');
}

// --- MENSAGENS COM BOTÃO DE RESPONDER ---
function listenToMessages() {
    const container = document.getElementById('messages-list');
    if (realTimeListener) realTimeListener();

    realTimeListener = db.collection("messages")
        .where("to", "==", currentUser.username)
        .orderBy("createdAt", "desc")
        .onSnapshot((snapshot) => {
            container.innerHTML = "";
            if (snapshot.empty) {
                container.innerHTML = '<p class="empty-state">Sem mensagens.</p>';
                return;
            }
            snapshot.forEach(doc => {
                createMessageCard(doc.data().text, container);
            });
        });
}

function createMessageCard(text, container) {
    const card = document.createElement('div');
    card.className = 'message-card';
    
    // Texto da pergunta
    const textElem = document.createElement('div');
    textElem.className = 'msg-text';
    textElem.innerText = text;
    
    // Botão de Responder (Gera Imagem)
    const btn = document.createElement('button');
    btn.className = 'btn-reply';
    btn.innerHTML = '<span class="material-icons">photo_camera</span> Responder no Story';
    btn.onclick = () => generateStoryImage(text); // Chama a função mágica

    card.appendChild(textElem);
    card.appendChild(btn);
    container.appendChild(card);
}

// --- FUNÇÃO MÁGICA: GERAR IMAGEM PARA STORY ---
function generateStoryImage(text) {
    // 1. Preenche o template escondido com o texto
    const storyText = document.getElementById('story-text');
    storyText.innerText = text;

    // 2. Tira print da div escondida usando html2canvas
    const element = document.getElementById('story-capture');
    
    // Avisa que está processando
    const originalText = "Aguarde...";
    
    html2canvas(element, {
        scale: 2, // Alta qualidade
        useCORS: true
    }).then(canvas => {
        // 3. Cria o link de download
        const link = document.createElement('a');
        link.download = `story_${currentUser.username}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        
        alert("Imagem salva! 📸\n\nAgora abra o Instagram, crie um Story e suba essa imagem.");
    }).catch(err => {
        console.error(err);
        alert("Erro ao gerar imagem.");
    });
}

function copyLink() {
    const copyText = document.getElementById("my-link");
    copyText.select();
    document.execCommand("copy");
    alert("Copiado!");
}

// --- VISITANTE ---
function simulateVisitorView() {
    const username = currentUser.username;
    const avatarUrl = `https://ui-avatars.com/api/?name=${username}&background=random&color=fff&bold=true&size=200`;
    loadPublicProfile(username, avatarUrl);
}

function loadPublicProfile(username, avatar) {
    document.getElementById('public-header').innerText = `Envie para @${username}`;
    document.getElementById('public-avatar').src = avatar;
    document.getElementById('public-screen').dataset.toUser = username;
    document.getElementById('question-input').value = "";
    showScreen('public');
}

function sendQuestion() {
    const text = document.getElementById('question-input').value;
    const toUser = document.getElementById('public-screen').dataset.toUser;
    
    if (!text.trim()) return alert("Escreva algo!");

    const btn = document.querySelector('.btn-send');
    btn.disabled = true; btn.innerText = "...";

    db.collection("messages").add({
        to: toUser,
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert("Enviado!");
        document.getElementById('question-input').value = "";
        if (currentUser && currentUser.username === toUser) showScreen('dashboard');
    })
    .finally(() => { btn.disabled = false; btn.innerText = "Enviar 🚀"; });
}

function rollDice() {
    const input = document.getElementById('question-input');
    input.value = diceQuestions[Math.floor(Math.random() * diceQuestions.length)];
}

function goToHome() {
    const baseUrl = window.location.href.split('?')[0];
    window.history.pushState({}, document.title, baseUrl);
    showScreen('login');
}

// --- START ---
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('u');
    
    if (userParam) {
        const avatarUrl = `https://ui-avatars.com/api/?name=${userParam}&background=random&color=fff&bold=true&size=200`;
        loadPublicProfile(userParam, avatarUrl);
    } else {
        const saved = localStorage.getItem('anonbox_user');
        if (saved) loginUser(JSON.parse(saved));
        else showScreen('login');
    }
};