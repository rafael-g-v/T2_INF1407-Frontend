/**
 * login.ts — Lógica da página de login.
 */
import { AuthAPI, TokenStore } from "./api.js";
import { requireGuest, showAlert, setLoading } from "./auth.js";
// Redireciona para dashboard se já estiver logado
requireGuest();
const form = document.getElementById("form-login");
const btnSubmit = document.getElementById("btn-login");
const inputUser = document.getElementById("username");
const inputPass = document.getElementById("password");
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = inputUser.value.trim();
    const password = inputPass.value;
    if (!username || !password) {
        showAlert("alert-area", "Preencha usuário e senha.");
        return;
    }
    setLoading(btnSubmit, true, "Entrar");
    try {
        const tokens = await AuthAPI.login(username, password);
        TokenStore.set(tokens.access, tokens.refresh);
        window.location.href = "dashboard.html";
    }
    catch (err) {
        showAlert("alert-area", err.message);
    }
    finally {
        setLoading(btnSubmit, false, "Entrar");
    }
});
