/**
 * api.ts — Cliente HTTP centralizado para a Academic Projects API.
 *
 * Responsabilidades:
 *  - Adicionar cabeçalho Authorization em todas as requisições autenticadas.
 *  - Tentar renovar o access token automaticamente ao receber 401.
 *  - Expor helpers tipados para cada recurso da API.
 */
// URL base da API — altere para a URL de produção antes de publicar
export const API_URL = window.API_URL ??
    "http://localhost:8000/api";
// ── Token storage ────────────────────────────────────────────────────────
export const TokenStore = {
    getAccess: () => localStorage.getItem("access_token"),
    getRefresh: () => localStorage.getItem("refresh_token"),
    set: (access, refresh) => {
        localStorage.setItem("access_token", access);
        localStorage.setItem("refresh_token", refresh);
    },
    setAccess: (access) => {
        localStorage.setItem("access_token", access);
    },
    clear: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("current_user");
    },
    isLogged: () => !!localStorage.getItem("access_token"),
};
// ── Token refresh ────────────────────────────────────────────────────────
async function tryRefresh() {
    const refresh = TokenStore.getRefresh();
    if (!refresh)
        return false;
    const res = await fetch(`${API_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
    });
    if (res.ok) {
        const data = await res.json();
        TokenStore.setAccess(data.access);
        return true;
    }
    return false;
}
export async function apiFetch(path, options = {}) {
    const { auth = true, noContentType = false, ...rest } = options;
    const headers = new Headers(rest.headers);
    if (!noContentType && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    if (auth) {
        const token = TokenStore.getAccess();
        if (token)
            headers.set("Authorization", `Bearer ${token}`);
    }
    let res = await fetch(`${API_URL}${path}`, { ...rest, headers });
    // Tenta renovar o token uma vez em caso de 401
    if (res.status === 401 && auth) {
        const renewed = await tryRefresh();
        if (renewed) {
            headers.set("Authorization", `Bearer ${TokenStore.getAccess()}`);
            res = await fetch(`${API_URL}${path}`, { ...rest, headers });
        }
        else {
            TokenStore.clear();
            window.location.href = "index.html";
        }
    }
    return res;
}
// ── Helper: normaliza resposta paginada ou array direto ──────────────────
/**
 * O backend usa PageNumberPagination (PAGE_SIZE=20) globalmente.
 * Listagens retornam { count, next, previous, results: [...] }.
 * Algumas rotas customizadas retornam array direto.
 * Normaliza os dois formatos.
 */
async function extractList(res) {
    const data = await res.json();
    if (data && Array.isArray(data.results))
        return data.results;
    if (Array.isArray(data))
        return data;
    return [];
}
// ── Helper: extrai mensagem de erro legível ──────────────────────────────
export async function extractError(res) {
    try {
        const data = await res.json();
        if (typeof data === "string")
            return data;
        if (data.detail)
            return data.detail;
        // Junta todos os valores do objeto de erros
        return Object.values(data)
            .flatMap((v) => (Array.isArray(v) ? v : [v]))
            .join(" | ");
    }
    catch {
        return `Erro ${res.status}`;
    }
}
// ── Auth ─────────────────────────────────────────────────────────────────
export const AuthAPI = {
    async login(username, password) {
        const res = await apiFetch("/auth/login/", {
            method: "POST",
            auth: false,
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async registrar(data) {
        const res = await apiFetch("/auth/registrar/", {
            method: "POST",
            auth: false,
            body: JSON.stringify(data),
        });
        if (!res.ok)
            throw new Error(await extractError(res));
    },
    async logout() {
        const refresh = TokenStore.getRefresh();
        await apiFetch("/auth/logout/", {
            method: "POST",
            body: JSON.stringify({ refresh }),
        }).catch(() => null);
        TokenStore.clear();
    },
    async getPerfil() {
        const res = await apiFetch("/auth/perfil/");
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async updatePerfil(data) {
        const res = await apiFetch("/auth/perfil/", {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
};
// ── Projetos ──────────────────────────────────────────────────────────────
export const ProjetoAPI = {
    async listar() {
        const res = await apiFetch("/projetos/");
        if (!res.ok)
            throw new Error(await extractError(res));
        return extractList(res);
    },
    async criar(nome, descricao) {
        const res = await apiFetch("/projetos/", {
            method: "POST",
            body: JSON.stringify({ nome, descricao }),
        });
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async detalhar(id) {
        const res = await apiFetch(`/projetos/${id}/`);
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async atualizar(id, data) {
        const res = await apiFetch(`/projetos/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async excluir(id) {
        const res = await apiFetch(`/projetos/${id}/`, { method: "DELETE" });
        if (!res.ok)
            throw new Error(await extractError(res));
    },
};
// ── Membros ───────────────────────────────────────────────────────────────
export const MembroAPI = {
    async listar(projetoId) {
        const res = await apiFetch(`/projetos/${projetoId}/membros/`);
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async remover(projetoId, membroId) {
        const res = await apiFetch(`/projetos/${projetoId}/membros/${membroId}/`, {
            method: "DELETE",
        });
        if (!res.ok)
            throw new Error(await extractError(res));
    },
};
// ── Convites ──────────────────────────────────────────────────────────────
export const ConviteAPI = {
    async meus() {
        const res = await apiFetch("/convites/");
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async doprojeto(projetoId) {
        const res = await apiFetch(`/projetos/${projetoId}/convites/`);
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async enviar(projetoId, usernameConvidado) {
        const res = await apiFetch(`/projetos/${projetoId}/convites/`, {
            method: "POST",
            body: JSON.stringify({ username_convidado: usernameConvidado }),
        });
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async aceitar(conviteId) {
        const res = await apiFetch(`/convites/${conviteId}/aceitar/`, { method: "POST" });
        if (!res.ok)
            throw new Error(await extractError(res));
    },
    async recusar(conviteId) {
        const res = await apiFetch(`/convites/${conviteId}/recusar/`, { method: "POST" });
        if (!res.ok)
            throw new Error(await extractError(res));
    },
};
export const TarefaAPI = {
    async listar(projetoId) {
        const res = await apiFetch(`/projetos/${projetoId}/tarefas/`);
        if (!res.ok)
            throw new Error(await extractError(res));
        return extractList(res);
    },
    async criar(projetoId, data) {
        const res = await apiFetch(`/projetos/${projetoId}/tarefas/`, {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async detalhar(projetoId, tarefaId) {
        const res = await apiFetch(`/projetos/${projetoId}/tarefas/${tarefaId}/`);
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async atualizar(projetoId, tarefaId, data) {
        const res = await apiFetch(`/projetos/${projetoId}/tarefas/${tarefaId}/`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async excluir(projetoId, tarefaId) {
        const res = await apiFetch(`/projetos/${projetoId}/tarefas/${tarefaId}/`, {
            method: "DELETE",
        });
        if (!res.ok)
            throw new Error(await extractError(res));
    },
};
// ── Observações ───────────────────────────────────────────────────────────
export const ObsAPI = {
    async listar(projetoId, tarefaId) {
        const res = await apiFetch(`/projetos/${projetoId}/tarefas/${tarefaId}/observacoes/`);
        if (!res.ok)
            throw new Error(await extractError(res));
        return extractList(res);
    },
    async criar(projetoId, tarefaId, texto) {
        const res = await apiFetch(`/projetos/${projetoId}/tarefas/${tarefaId}/observacoes/`, {
            method: "POST",
            body: JSON.stringify({ texto }),
        });
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async atualizar(projetoId, tarefaId, obsId, texto) {
        const res = await apiFetch(`/projetos/${projetoId}/tarefas/${tarefaId}/observacoes/${obsId}/`, { method: "PATCH", body: JSON.stringify({ texto }) });
        if (!res.ok)
            throw new Error(await extractError(res));
        return res.json();
    },
    async excluir(projetoId, tarefaId, obsId) {
        const res = await apiFetch(`/projetos/${projetoId}/tarefas/${tarefaId}/observacoes/${obsId}/`, { method: "DELETE" });
        if (!res.ok)
            throw new Error(await extractError(res));
    },
};
