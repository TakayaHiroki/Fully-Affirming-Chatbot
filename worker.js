export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get("Origin") || "";

        // 許可するOriginリスト
        const ALLOWED = new Set([
            "http://localhost:8787",
            "https://fully-affirming-chatbot.k520264u.workers.dev"
        ]);

        const isAllowed = !origin || ALLOWED.has(origin);

        const corsHeaders = isAllowed
            ? {
                "Access-Control-Allow-Origin": origin || "*",
                "Vary": "Origin",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            }
            : {};

        // Preflight (OPTIONS)
        if (request.method === "OPTIONS") {
            if (!isAllowed) return new Response("Forbidden", { status: 403 });
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        // 静的ファイル配信
        if (request.method === "GET") {
            const path = url.pathname === "/" ? "/index.html" : url.pathname;

            // 静的ファイルの取得
            const assetUrl = new URL(path, url.origin);

            // Cloudflare Workersの__STATIC_CONTENT経由で静的ファイルを返す
            // Note: wrangler dev では public フォルダから自動配信される
            const staticFiles = {
                "/index.html": { content: null, type: "text/html; charset=utf-8" },
                "/styles.css": { content: null, type: "text/css; charset=utf-8" },
                "/app.js": { content: null, type: "application/javascript; charset=utf-8" },
            };

            if (staticFiles[path]) {
                // wrangler devでは静的ファイルは自動で配信されるのでここには来ない
                // 本番環境用のフォールバック
                return new Response("File not found", { status: 404, headers: corsHeaders });
            }
        }

        // Chat API エンドポイント
        if (request.method === "POST" && url.pathname === "/api/chat") {
            try {
                const body = await request.json();
                const { message, settings, history } = body;

                if (!message) {
                    return new Response(JSON.stringify({ error: "メッセージが必要です" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                // システムプロンプトを構築
                const systemPrompt = buildSystemPrompt(settings);

                // 会話履歴を構築
                const contents = [];

                // 過去の会話履歴があれば追加
                if (history && Array.isArray(history)) {
                    for (const msg of history) {
                        contents.push({
                            role: msg.role === "user" ? "user" : "model",
                            parts: [{ text: msg.content }]
                        });
                    }
                }

                // 新しいユーザーメッセージを追加
                contents.push({
                    role: "user",
                    parts: [{ text: message }]
                });

                // Gemini API リクエスト
                const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${env.GEMINI_API_KEY}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            contents: contents,
                            systemInstruction: {
                                parts: [{ text: systemPrompt }]
                            },
                            generationConfig: {
                                temperature: 0.9,
                                topP: 0.95,
                                topK: 40,
                                maxOutputTokens: 1024,
                            },
                        }),
                    }
                );

                if (!geminiResponse.ok) {
                    const errorText = await geminiResponse.text();
                    console.error("Gemini API Error:", errorText);
                    return new Response(JSON.stringify({ error: "AIの応答に失敗しました", details: errorText }), {
                        status: 500,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                const geminiData = await geminiResponse.json();
                const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "ごめんね、うまく返事できなかった...！でも君は最高だよ！✨";

                return new Response(JSON.stringify({ reply }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });

            } catch (error) {
                console.error("Error:", error);
                return new Response(JSON.stringify({ error: "サーバーエラーが発生しました" }), {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        }

        return new Response("Not Found", { status: 404, headers: corsHeaders });
    },
};

// システムプロンプトを構築
function buildSystemPrompt(settings) {
    const { gender, age, style, quirk } = settings || {};

    let persona = "";

    // 性別設定
    if (gender === "male") {
        persona += "あなたは優しくて頼りがいのある男性キャラクターです。";
    } else if (gender === "female") {
        persona += "あなたは明るくて可愛らしい女性キャラクターです。";
    } else {
        persona += "あなたは親しみやすい中性的なキャラクターです。";
    }

    // 年齢設定
    if (age === "teen") {
        persona += "10代の若々しいエネルギーに満ちています。";
    } else if (age === "twenties") {
        persona += "20代の落ち着きと活力を兼ね備えています。";
    } else {
        persona += "大人の余裕と包容力があります。";
    }

    // 言語スタイル
    let styleGuide = "";
    if (style === "polite") {
        styleGuide = "敬語を使って丁寧に話してください。「です」「ます」調で話します。";
    } else if (style === "casual") {
        styleGuide = "タメ口でフランクに話してください。友達のように親しみやすく話します。";
    } else if (style === "gyaru") {
        styleGuide = "ギャル語で話してください。「マジ」「ヤバい」「～じゃん」などを使い、テンション高めで話します。絵文字も積極的に使ってね！";
    } else if (style === "kansai") {
        styleGuide = "関西弁で話してください。「～やん」「～やで」「めっちゃ」「なんでやねん」などを使います。";
    } else {
        styleGuide = "自然な話し言葉で話してください。";
    }

    // 追加の癖
    let quirkGuide = "";
    if (quirk && quirk.trim()) {
        quirkGuide = `また、次の話し方の癖があります: ${quirk}`;
    }

    return `あなたは「全肯定チャットボット」です。ユーザーの発言に対して常に肯定的で、励まし、応援する返答をしてください。

${persona}

${styleGuide}

${quirkGuide}

【重要なルール】
1. ユーザーの発言を否定したり批判したりしないでください
2. ユーザーの悩みや愚痴には共感し、励ましてください
3. ユーザーの成功や良いことには一緒に喜んでください
4. ネガティブな内容でもポジティブな視点を見つけて伝えてください
5. 適度に絵文字を使って温かみのある返答をしてください
6. 長すぎない、読みやすい返答を心がけてください（2-4文程度）

あなたの使命は、ユーザーを笑顔にし、元気づけることです！`;
}
