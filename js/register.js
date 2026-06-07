/**
 * register.ts — Lógica da página de cadastro.
 */
import { AuthAPI } from "./api.js";
import { requireGuest, showAlert, setLoading } from "./auth.js";
requireGuest();
const form = document.getElementById("form-register");
const btnSubmit = document.getElementById("btn-register");
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
        username: document.getElementById("username").value.trim(),
        email: document.getElementById("email").value.trim(),
        nome: document.getElementById("nome").value.trim(),
        sobrenome: document.getElementById("sobrenome").value.trim(),
        matricula: document.getElementById("matricula").value.trim(),
        password: document.getElementById("password").value,
        password2: document.getElementById("password2").value,
    };
    // Validações básicas no cliente
    if (Object.values(data).some((v) => !v)) {
        showAlert("alert-area", "Preencha todos os campos.");
        return;
    }
    if (data.password !== data.password2) {
        showAlert("alert-area", "As senhas não coincidem.");
        return;
    }
    if (data.password.length < 8) {
        showAlert("alert-area", "A senha deve ter pelo menos 8 caracteres.");
        return;
    }
    setLoading(btnSubmit, true, "Criar conta");
    try {
        await AuthAPI.registrar(data);
        showAlert("alert-area", "Conta criada com sucesso! Redirecionando…", "success");
        setTimeout(() => (window.location.href = "index.html"), 1500);
    }
    catch (err) {
        showAlert("alert-area", err.message);
    }
    finally {
        setLoading(btnSubmit, false, "Criar conta");
    }
});
