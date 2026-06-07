/**
 * register.ts — Lógica da página de cadastro.
 */

import { AuthAPI } from "./api.js";
import { requireGuest, showAlert, setLoading } from "./auth.js";

requireGuest();

const form = document.getElementById("form-register") as HTMLFormElement;
const btnSubmit = document.getElementById("btn-register") as HTMLButtonElement;

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    username:   (document.getElementById("username")  as HTMLInputElement).value.trim(),
    email:      (document.getElementById("email")     as HTMLInputElement).value.trim(),
    nome:       (document.getElementById("nome")      as HTMLInputElement).value.trim(),
    sobrenome:  (document.getElementById("sobrenome") as HTMLInputElement).value.trim(),
    matricula:  (document.getElementById("matricula") as HTMLInputElement).value.trim(),
    password:   (document.getElementById("password")  as HTMLInputElement).value,
    password2:  (document.getElementById("password2") as HTMLInputElement).value,
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
  } catch (err) {
    showAlert("alert-area", (err as Error).message);
  } finally {
    setLoading(btnSubmit, false, "Criar conta");
  }
});
