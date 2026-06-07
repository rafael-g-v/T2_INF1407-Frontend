/**
 * task.ts — Página de detalhe de tarefa com CRUD de observações.
 */
import { TarefaAPI, ObsAPI, MembroAPI } from "./api.js";
import { requireAuth, loadSidebar, showAlert, clearAlert, setLoading, formatDate, formatDateTime, relativeTime, getQueryParam, } from "./auth.js";
requireAuth();
// ── Estado ────────────────────────────────────────────────────────────────
const projetoId = Number(getQueryParam("projeto"));
const tarefaId = Number(getQueryParam("id"));
if (!projetoId || !tarefaId)
    window.location.href = "dashboard.html";
let tarefa = null;
let observacoes = [];
let membros = [];
let currentUsername = "";
let isLider = false;
let editingObsId = null;
// ── Bootstrap ─────────────────────────────────────────────────────────────
(async () => {
    const perfil = await loadSidebar("dashboard");
    currentUsername = perfil?.username ?? "";
    try {
        [tarefa, membros] = await Promise.all([
            TarefaAPI.detalhar(projetoId, tarefaId),
            MembroAPI.listar(projetoId),
        ]);
        const me = membros.find((m) => m.usuario.username === currentUsername);
        isLider = me?.papel === "L";
        renderTarefa();
        await loadObservacoes();
        setupUI();
    }
    catch (err) {
        document.getElementById("task-body").innerHTML =
            `<div class="alert alert-error">${err.message}</div>`;
    }
})();
// ── Render tarefa ─────────────────────────────────────────────────────────
function renderTarefa() {
    if (!tarefa)
        return;
    const statusLabels = { P: "Pendente", E: "Em andamento", C: "Concluída" };
    const statusBadge = { P: "badge-gray", E: "badge-blue", C: "badge-green" };
    document.getElementById("task-titulo").textContent = tarefa.titulo;
    document.getElementById("task-descricao").textContent = tarefa.descricao;
    document.getElementById("task-status-badge").innerHTML =
        `<span class="badge ${statusBadge[tarefa.status]}">${statusLabels[tarefa.status]}</span>`;
    document.getElementById("task-meta").innerHTML = [
        tarefa.prazo ? `<span>📅 Prazo: <strong>${formatDate(tarefa.prazo)}</strong></span>` : "",
        tarefa.responsavel ? `<span>👤 Responsável: <strong>${tarefa.responsavel.username}</strong></span>` : "",
        `<span class="text-xs text-muted font-mono">Criado em ${formatDate(tarefa.criado_em)}</span>`,
    ].filter(Boolean).join(" · ");
    // Link para o projeto
    const link = document.getElementById("link-projeto");
    if (link)
        link.href = `/project.html?id=${projetoId}`;
    // Painel de edição rápida de status (qualquer membro pode mudar)
    const statusSel = document.getElementById("quick-status");
    if (statusSel) {
        statusSel.value = tarefa.status;
        statusSel.addEventListener("change", () => quickStatusChange(statusSel));
    }
    // Botões líder
    const actionsEl = document.getElementById("task-actions");
    if (isLider) {
        actionsEl.innerHTML = `
      <button id="btn-edit-task" class="btn btn-secondary btn-sm">✏️ Editar</button>
      <button id="btn-delete-task" class="btn btn-danger btn-sm">🗑 Excluir</button>`;
        document.getElementById("btn-edit-task")?.addEventListener("click", openEditTask);
        document.getElementById("btn-delete-task")?.addEventListener("click", confirmDeleteTask);
    }
}
async function quickStatusChange(sel) {
    const newStatus = sel.value;
    sel.disabled = true;
    try {
        tarefa = await TarefaAPI.atualizar(projetoId, tarefaId, { status: newStatus });
        renderTarefa();
    }
    catch (err) {
        alert(err.message);
        sel.value = tarefa?.status ?? "P";
    }
    finally {
        sel.disabled = false;
    }
}
// ── Observações ───────────────────────────────────────────────────────────
async function loadObservacoes() {
    const el = document.getElementById("obs-list");
    el.innerHTML = `<div class="loading-center"><span class="spinner"></span></div>`;
    observacoes = await ObsAPI.listar(projetoId, tarefaId);
    renderObservacoes();
}
function renderObservacoes() {
    const el = document.getElementById("obs-list");
    const countEl = document.getElementById("obs-count");
    if (countEl)
        countEl.textContent = String(observacoes.length);
    if (!observacoes.length) {
        el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <h3>Nenhuma observação ainda</h3>
        <p>Seja o primeiro a comentar nesta tarefa.</p>
      </div>`;
        return;
    }
    el.innerHTML = observacoes
        .map((o) => {
        const isAuthor = o.autor.username === currentUsername;
        const canEdit = isAuthor;
        const canDel = isAuthor || isLider;
        const actions = (canEdit || canDel) ? `
        <div style="display:flex;gap:4px">
          ${canEdit ? `<button class="btn btn-ghost btn-sm btn-edit-obs" data-id="${o.id}">✏️</button>` : ""}
          ${canDel ? `<button class="btn btn-ghost btn-sm btn-del-obs"  data-id="${o.id}">🗑</button>` : ""}
        </div>` : "";
        return `
        <div class="obs-item">
          <div class="obs-header">
            <div>
              <span class="obs-author">@${o.autor.username}</span>
              <span class="obs-time" title="${formatDateTime(o.criado_em)}">${relativeTime(o.criado_em)}</span>
            </div>
            ${actions}
          </div>
          <div class="obs-text" id="obs-text-${o.id}">${escHtml(o.texto)}</div>
          <div id="obs-edit-${o.id}" class="hidden" style="margin-top:8px">
            <textarea class="form-control" id="obs-edit-area-${o.id}" rows="3">${escHtml(o.texto)}</textarea>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="btn btn-primary btn-sm btn-save-obs-edit" data-id="${o.id}">Salvar</button>
              <button class="btn btn-ghost btn-sm btn-cancel-obs-edit" data-id="${o.id}">Cancelar</button>
            </div>
          </div>
        </div>`;
    })
        .join("");
    // Binds
    el.querySelectorAll(".btn-edit-obs").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = Number(btn.dataset["id"]);
            toggleObsEdit(id, true);
        });
    });
    el.querySelectorAll(".btn-del-obs").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (confirm("Excluir esta observação?"))
                deleteObs(Number(btn.dataset["id"]));
        });
    });
    el.querySelectorAll(".btn-save-obs-edit").forEach((btn) => {
        btn.addEventListener("click", () => saveObsEdit(Number(btn.dataset["id"]), btn));
    });
    el.querySelectorAll(".btn-cancel-obs-edit").forEach((btn) => {
        btn.addEventListener("click", () => toggleObsEdit(Number(btn.dataset["id"]), false));
    });
}
function toggleObsEdit(id, open) {
    document.getElementById(`obs-text-${id}`)?.classList.toggle("hidden", open);
    document.getElementById(`obs-edit-${id}`)?.classList.toggle("hidden", !open);
    if (open)
        editingObsId = id;
    else
        editingObsId = null;
}
async function saveObsEdit(id, btn) {
    const area = document.getElementById(`obs-edit-area-${id}`);
    const texto = area.value.trim();
    if (!texto) {
        alert("A observação não pode ficar vazia.");
        return;
    }
    setLoading(btn, true, "Salvar");
    try {
        await ObsAPI.atualizar(projetoId, tarefaId, id, texto);
        await loadObservacoes();
    }
    catch (err) {
        alert(err.message);
    }
    finally {
        setLoading(btn, false, "Salvar");
    }
}
async function deleteObs(id) {
    try {
        await ObsAPI.excluir(projetoId, tarefaId, id);
        await loadObservacoes();
    }
    catch (err) {
        alert(err.message);
    }
}
// ── Nova observação ───────────────────────────────────────────────────────
function setupUI() {
    const form = document.getElementById("form-obs");
    const btnSave = document.getElementById("btn-send-obs");
    const textarea = document.getElementById("obs-texto");
    // Auto-resize da textarea
    textarea.addEventListener("input", () => {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
    });
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const texto = textarea.value.trim();
        if (!texto) {
            showAlert("alert-obs", "Escreva algo antes de enviar.");
            return;
        }
        setLoading(btnSave, true, "Enviar");
        try {
            await ObsAPI.criar(projetoId, tarefaId, texto);
            textarea.value = "";
            textarea.style.height = "auto";
            clearAlert("alert-obs");
            await loadObservacoes();
        }
        catch (err) {
            showAlert("alert-obs", err.message);
        }
        finally {
            setLoading(btnSave, false, "Enviar");
        }
    });
}
// ── Editar tarefa (líder) ─────────────────────────────────────────────────
function openEditTask() {
    if (!tarefa)
        return;
    // Preenche o select de responsável
    const sel = document.getElementById("edit-responsavel");
    sel.innerHTML =
        `<option value="">— Sem responsável —</option>` +
            membros.map((m) => `<option value="${m.usuario.id}">${escHtml(m.usuario.nome_completo)} (@${m.usuario.username})</option>`).join("");
    document.getElementById("edit-titulo").value = tarefa.titulo;
    document.getElementById("edit-descricao").value = tarefa.descricao;
    document.getElementById("edit-status").value = tarefa.status;
    document.getElementById("edit-prazo").value = tarefa.prazo ?? "";
    sel.value = String(tarefa.responsavel?.id ?? "");
    clearAlert("alert-edit-task");
    document.getElementById("modal-edit-task").classList.remove("hidden");
}
document.getElementById("btn-close-edit-task")?.addEventListener("click", () => {
    document.getElementById("modal-edit-task").classList.add("hidden");
});
document.getElementById("form-edit-task")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-save-edit-task");
    const titulo = document.getElementById("edit-titulo").value.trim();
    const descricao = document.getElementById("edit-descricao").value.trim();
    const status = document.getElementById("edit-status").value;
    const prazo = document.getElementById("edit-prazo").value || null;
    const respIdStr = document.getElementById("edit-responsavel").value;
    const responsavel_id = respIdStr ? Number(respIdStr) : null;
    if (!titulo || !descricao) {
        showAlert("alert-edit-task", "Preencha título e descrição.");
        return;
    }
    setLoading(btn, true, "Salvar");
    try {
        tarefa = await TarefaAPI.atualizar(projetoId, tarefaId, {
            titulo, descricao, status, prazo, responsavel_id,
        });
        document.getElementById("modal-edit-task").classList.add("hidden");
        renderTarefa();
    }
    catch (err) {
        showAlert("alert-edit-task", err.message);
    }
    finally {
        setLoading(btn, false, "Salvar");
    }
});
async function confirmDeleteTask() {
    if (!confirm(`Excluir a tarefa "${tarefa?.titulo}"?`))
        return;
    try {
        await TarefaAPI.excluir(projetoId, tarefaId);
        window.location.href = `/project.html?id=${projetoId}`;
    }
    catch (err) {
        alert(err.message);
    }
}
// ── Utilitário ────────────────────────────────────────────────────────────
function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
