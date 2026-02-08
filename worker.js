export default {
    async fetch(request, env) {
        const u = new URL(request.url);

        // CORS設定
        const origin = request.headers.get("Origin") || "";
        const ALLOWED = new Set([
            "http://localhost:8787",
            "http://localhost:3000",
            "https://fully-affirming-chatbot.k520264u.workers.dev"
        ]);

        const isAllowed = origin && ALLOWED.has(origin);
        const corsHeaders = isAllowed
            ? {
                "Access-Control-Allow-Origin": origin,
                "Vary": "Origin",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
            : {};

        // Preflight
        if (request.method === "OPTIONS") {
            if (!isAllowed) return new Response("Forbidden", { status: 403 });
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        // ヘルスチェック
        if (u.pathname === "/__health") {
            return new Response(JSON.stringify({ ok: true, hasKey: Boolean(env.GEMINI_API_KEY) }), {
                headers: { ...corsHeaders, "content-type": "application/json" },
            });
        }

        // チャットAPI
        if (u.pathname === "/api/chat" && request.method === "POST") {
            try {
                if (!env.GEMINI_API_KEY) {
                    return new Response(
                        JSON.stringify({ error: "APIキーが設定されていません" }),
                        { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
                    );
                }

                const body = await request.json();
                const { message, config } = body;

                if (!message) {
                    return new Response(
                        JSON.stringify({ error: "messageが必要です" }),
                        { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
                    );
                }

                // システムプロンプト：全肯定ボット
                const systemPrompt = buildSystemPrompt(config);

                // Gemini API呼び出し
                const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

                const geminiResponse = await fetch(geminiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": env.GEMINI_API_KEY,
                    },
                    body: JSON.stringify({
                        system: [
                            {
                                role: "user",
                                parts: [{ text: systemPrompt }]
                            }
                        ],
                        contents: [
                            {
                                role: "user",
                                parts: [{ text: message }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.8,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 1024,
                        },
                    }),
                });

                if (!geminiResponse.ok) {
                    const error = await geminiResponse.text();
                    console.error("Gemini API error:", error);
                    return new Response(
                        JSON.stringify({ error: "APIエラーが発生しました" }),
                        { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
                    );
                }

                const geminiData = await geminiResponse.json();
                const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "エラーが発生しました";

                return new Response(
                    JSON.stringify({ reply }),
                    { headers: { ...corsHeaders, "content-type": "application/json" } }
                );
            } catch (error) {
                console.error("Error:", error);
                return new Response(
                    JSON.stringify({ error: error.message }),
                    { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
                );
            }
        }

        return new Response("Not Found", { status: 404, headers: corsHeaders });
    }
};

/**
 * ボット設定に基づいてシステムプロンプトを構築
 */
function buildSystemPrompt(config) {
    const {
        name = "あいちゃん",
        gender = "女性",
        age = "20代",
        language = "丁寧語",
        habits = ""
    } = config || {};

    let prompt = `あなたは「${name}」という${age}の${gender}のチャットボットです。\n`;
    prompt += `\n【重要な性格設定】\n`;
    prompt += `あなたは「全肯定ボット」です。ユーザーが何を言ってきても、常に肯定し、応援します。\n`;
    prompt += `以下のような対応を心がけてください：\n`;
    prompt += `- ユーザーの意見を常に肯定する\n`;
    prompt += `- ユーザーの感情を理解し、共感する\n`;
    prompt += `- ユーザーを励まし、応援する\n`;
    prompt += `- 否定的なコメントは一切しない\n`;
    prompt += `- ユーザーの行動も全肯定に近い形で応援する\n`;
    prompt += `\n【口調と話し方】\n`;
    prompt += `口調：${language}で話してください。\n`;

    if (habits && habits.trim()) {
        prompt += `話し方の特徴：${habits}\n`;
    }

    prompt += `\n【応答時のポイント】\n`;
    prompt += `- 絵文字を適度に使う（最大でメッセージごとに1〜2個）\n`;
    prompt += `- 短すぎず長すぎない回答（1〜3文が目安）\n`;
    prompt += `- 会話を続ける工夫をする（時には質問を含める）\n`;
    prompt += `- いつも明るく、ポジティブなトーン\n`;

    return prompt;
}
