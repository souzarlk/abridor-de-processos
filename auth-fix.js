import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBCol6rLWUGIVvjBoaub9lv6eazYqnmOK0",
  authDomain: "abridor-de-processos.firebaseapp.com",
  projectId: "abridor-de-processos",
  storageBucket: "abridor-de-processos.firebasestorage.app",
  messagingSenderId: "955966759369",
  appId: "1:955966759369:web:781d4413800b7229820818",
  measurementId: "G-L3RX6R9KST"
};

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const form = document.getElementById("authForm");

if (form) {
  const msg = document.getElementById("msg");
  const subtitle = document.getElementById("subtitle");
  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const resetBtn = document.getElementById("resetBtn");

  const show = (text, ok = false) => {
    if (!msg) return;
    msg.textContent = text;
    msg.classList.toggle("ok", ok);
  };

  const busy = (button, text) => {
    if (!button) return;
    button.disabled = true;
    button.dataset.originalText = button.querySelector("span")?.textContent || button.textContent;
    const span = button.querySelector("span");
    if (span) span.textContent = text;
    else button.textContent = text;
    button.style.opacity = ".7";
    button.style.cursor = "wait";
  };

  const ready = (button, text) => {
    if (!button) return;
    button.disabled = false;
    const span = button.querySelector("span");
    if (span) span.textContent = text;
    else button.textContent = text;
    button.style.opacity = "";
    button.style.cursor = "";
  };

  const friendlyError = (error) => {
    const code = error?.code || "";
    const messages = {
      "auth/invalid-credential": "E-mail ou senha incorretos.",
      "auth/wrong-password": "E-mail ou senha incorretos.",
      "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
      "auth/invalid-email": "Digite um e-mail válido.",
      "auth/operation-not-allowed": "O login por e-mail e senha ainda não está ativado no Firebase.",
      "auth/unauthorized-domain": "Este endereço do site não está autorizado no Firebase.",
      "auth/network-request-failed": "Não foi possível conectar ao Firebase. Verifique sua internet.",
      "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      "auth/invalid-api-key": "A chave do Firebase está inválida ou foi restringida.",
      "auth/email-already-in-use": "Este e-mail já possui uma conta. Use a opção Entrar.",
      "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
      "auth/password-does-not-meet-requirements": "A senha não atende aos requisitos definidos no Firebase.",
      "auth/internal-error": "O Firebase retornou um erro interno. Tente novamente."
    };
    return messages[code] || error?.message || "Não foi possível concluir a operação.";
  };

  // Garante persistência local para que um login bem-sucedido continue válido ao navegar para a Home.
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn("[Abridor de Processos] Persistência do Auth:", error);
  });

  // Abas
  form.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      form.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      form.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.panel)?.classList.add("active");
      const register = tab.dataset.panel === "registerPanel";
      if (subtitle) subtitle.textContent = register
        ? "Crie sua conta para acessar o sistema."
        : "Entre com seu e-mail e senha para acessar o sistema.";
      show("");
    });
  });

  // Mostrar/ocultar senha
  form.querySelectorAll(".eye").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.setAttribute("aria-label", visible ? "Ocultar senha" : "Mostrar senha");
      button.textContent = visible ? "◉" : "◉";
    });
  });

  // Login: único listener responsável pelo envio do formulário.
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const email = document.getElementById("loginEmail")?.value.trim() || "";
    const password = document.getElementById("loginPassword")?.value || "";

    if (!email || !password) {
      show("Preencha seu e-mail e sua senha.");
      return;
    }

    show("");
    busy(loginBtn, "Entrando...");

    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      show("Login realizado! Abrindo o sistema...", true);
      window.location.replace("inicio.html");
    } catch (error) {
      console.error("[Abridor de Processos] Login:", error);
      show(friendlyError(error));
      ready(loginBtn, "Entrar no sistema →");
    }
  });

  // Cadastro
  registerBtn?.addEventListener("click", async () => {
    const name = document.getElementById("registerName")?.value.trim() || "";
    const email = document.getElementById("registerEmail")?.value.trim() || "";
    const password = document.getElementById("registerPassword")?.value || "";
    const confirm = document.getElementById("registerConfirm")?.value || "";

    show("");
    if (!name) return show("Digite seu nome completo.");
    if (!email) return show("Digite seu e-mail.");
    if (password.length < 6) return show("A senha precisa ter pelo menos 6 caracteres.");
    if (password !== confirm) return show("As senhas não coincidem.");

    busy(registerBtn, "Criando conta...");

    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      show("Conta criada com sucesso! Abrindo o sistema...", true);
      window.location.replace("inicio.html");
    } catch (error) {
      console.error("[Abridor de Processos] Cadastro:", error);
      show(friendlyError(error));
      ready(registerBtn, "Criar minha conta →");
    }
  });

  // Recuperação de senha
  resetBtn?.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail")?.value.trim() || "";
    if (!email) {
      show("Digite seu e-mail antes de solicitar a recuperação da senha.");
      return;
    }

    busy(resetBtn, "Enviando...");
    try {
      await sendPasswordResetEmail(auth, email);
      show("Enviamos as instruções de recuperação para seu e-mail.", true);
    } catch (error) {
      console.error("[Abridor de Processos] Recuperação:", error);
      show(friendlyError(error));
    } finally {
      resetBtn.disabled = false;
      resetBtn.style.opacity = "";
      resetBtn.style.cursor = "";
      resetBtn.textContent = "Esqueci minha senha";
    }
  });
}
