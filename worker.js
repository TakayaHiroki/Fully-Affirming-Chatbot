export default {
    async fetch(request, env) {
        const u = new URL(request.url);

        // ▼▼▼ CORS設定（ここが重要） ▼▼▼
        const origin = request.headers.get("Origin") || "";

        // 許可するURLリスト（末尾のスラッシュは無しで記述）
        const ALLOWED = new Set([
            "http://localhost:8787",             // ローカル開発用
            "https://fully-affirming-chatbot.k520264u.workers.dev/"
        ]);

        const isAllowed = origin && ALLOWED.has(origin);

        // 許可されたOriginなら、そのOriginを返す（Echo方式）
        const corsHeaders = isAllowed
            ? {
                "Access-Control-Allow-Origin": origin,
                "Vary": "Origin",
                "Access-Control-Allow-Methods": "GET,OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
            : {};

        // Preflight (OPTIONS)
        if (request.method === "OPTIONS") {
            if (!isAllowed) return new Response("Forbidden", { status: 403 });
            return new Response(null, { status: 204, headers: corsHeaders });
        }
        // ▲▲▲ CORS設定ここまで ▲▲▲

        const api = u.searchParams.get("api");

        // ヘルスチェック（設定確認用）
        if (api === "__health") {
            return new Response(JSON.stringify({ ok: true, hasKey: Boolean(env.API_KEY) }), {
                headers: { ...corsHeaders, "content-type": "application/json" },
            });
        }

        if (!api) return new Response("missing api param", { status: 400, headers: corsHeaders });

        // 外部APIへ中継（ここでAPIキーを付与）
        u.searchParams.delete("api");
        const targetUrl = new URL(`https://www.reinfolib.mlit.go.jp/ex-api/external/${api}`);
        for (const [k, v] of u.searchParams) targetUrl.searchParams.set(k, v);

        const res = await fetch(targetUrl.toString(), {
            method: "GET",
            headers: {
                "Ocp-Apim-Subscription-Key": env.API_KEY, // Secretから読み込み
            },
        });

        const body = await res.arrayBuffer();
        const headers = new Headers(res.headers);
        // レスポンスにもCORSヘッダを付与
        for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);

        return new Response(body, { status: res.status, headers });
    },
};
