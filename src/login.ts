/**
 * login.ts — Lógica da página de login.
 */

import { AuthAPI, TokenStore } from "./api.js";
import { requireGuest, showAlert, setLoading } from "./auth.js";

// Redireciona para dashboard se já estiver logado
requireGuest();

const form = document.getElementById("form-login") as HTMLFormElement;
const btnSubmit = document.getElementById("btn-login") as HTMLButtonElement;
const inputUser = document.getElementById("username") as HTMLInputElement;
const inputPass = document.getElementById("password") as HTMLInputElement;

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
  } catch (err) {
    showAlert("alert-area", (err as Error).message);
  } finally {
    setLoading(btnSubmit, false, "Entrar");
  }
});
