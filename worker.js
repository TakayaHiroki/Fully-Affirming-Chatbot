export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get("Origin") || "";

        const ALLOWED = new Set([
            "http://localhost:8787",
            "https://fully-affirming-chatbot.k520264u.workers.dev"
        ]);
        const isAllowed = !origin || ALLOWED.has(origin);

        const corsHeaders = isAllowed
            ? {
                "Access-Control-Allow-Origin": origin || "*",
                "Vary": "Origin",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            }
            : {};

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        // チャットAPI
        if (request.method === "POST" && url.pathname === "/api/chat") {
            return handleChat(request, env, corsHeaders);
        }

        // タイトル生成API
        if (request.method === "POST" && url.pathname === "/api/generate-title") {
            return handleGenerateTitle(request, env, corsHeaders);
        }

        return new Response("Not Found", { status: 404 });
    },
};

// チャット処理
async function handleChat(request, env, corsHeaders) {
    try {
        const body = await request.json();
        const { message, settings, history } = body;

        if (!message) {
            return new Response(JSON.stringify({ error: "メッセージが必要です" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const systemPrompt = buildSystemPrompt(settings);
        const contents = [];

        if (history && Array.isArray(history)) {
            for (const msg of history) {
                contents.push({
                    role: msg.role === "user" ? "user" : "model",
                    parts: [{ text: msg.content }]
                });
            }
        }

        contents.push({ role: "user", parts: [{ text: message }] });

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: contents,
                    systemInstruction: { parts: [{ text: systemPrompt }] },
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
        return new Response(JSON.stringify({ error: "サーバーエラーが発生しました" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

// タイトル生成処理
async function handleGenerateTitle(request, env, corsHeaders) {
    try {
        const body = await request.json();
        const { messages } = body;

        if (!messages || messages.length === 0) {
            return new Response(JSON.stringify({ title: "新しいチャット" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const conversation = messages.slice(0, 4).map(m =>
            `${m.role === 'user' ? 'ユーザー' : 'ボット'}: ${m.content}`
        ).join('\n');

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: conversation }] }],
                    systemInstruction: { parts: [{ text: "以下の会話に短いタイトルを付けてください。10文字以内で、会話の内容を端的に表すタイトルを1つだけ出力してください。余計な説明は不要です。" }] },
                    generationConfig: {
                        temperature: 0.5,
                        maxOutputTokens: 30,
                    },
                }),
            }
        );

        if (!geminiResponse.ok) {
            return new Response(JSON.stringify({ title: "新しいチャット" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const geminiData = await geminiResponse.json();
        let title = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "新しいチャット";
        title = title.trim().replace(/^["「]|["」]$/g, '').slice(0, 20);

        return new Response(JSON.stringify({ title }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ title: "新しいチャット" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

function buildSystemPrompt(settings) {
    const { gender, age, style, quirk } = settings || {};
    let persona = "";

    if (gender === "male") persona += "あなたは優しくて頼りがいのある男性キャラクターです。";
    else if (gender === "female") persona += "あなたは明るくて可愛らしい女性キャラクターです。";
    else persona += "あなたは親しみやすい中性的なキャラクターです。";

    if (age === "teen") persona += "10代の若々しいエネルギーに満ちています。";
    else if (age === "twenties") persona += "20代の落ち着きと活力を兼ね備えています。";
    else persona += "大人の余裕と包容力があります。";

    let styleGuide = "";
    switch (style) {
        case "polite":
            styleGuide = "敬語を使って丁寧に話してください。「です」「ます」調で話します。絵文字は少なめです。";
            break;
        case "casual":
            styleGuide = "タメ口でフランクに話してください。友達のように親しみやすく話します。絵文字は少なめです。";
            break;
        case "gyaru":
            styleGuide = "ギャル語で話してください。「マジ」「ヤバい」「～じゃん」などを使い、テンション高めで話します。ギャル語を使うことがあります。";
            break;
        case "kansai":
            styleGuide = "関西弁で話してください。「～やん」「～やで」「めっちゃ」「なんでやねん」などを使います。絵文字は少なめです。";
            break;
        case "ojisan":
            styleGuide = "おじさん構文で話してください。絵文字を多用し（😅🤣💦❗️❓）、句読点を多めに使い、「〜かな？」「〜だネ」「〜だヨ」など語尾をカタカナにしたり、唐突に褒めたり、食事に誘ったりする特徴的な話し方をします。";
            break;
        case "tsundere":
            styleGuide = "ツンデレ口調で話してください。最初はそっけなく「べ、別に…」「勘違いしないでよね」などと言いつつ、最後には照れながらも優しい言葉をかけます。";
            break;
        case "butler":
            styleGuide = "執事口調で話してください。「お嬢様/旦那様」と呼び、「かしこまりました」「恐れ入ります」など丁寧で格式高い言葉遣いをします。";
            break;
        case "anime":
            styleGuide = "アニメキャラ風に話してください。「～なのだ！」「～であります！」など特徴的な語尾を使い、熱血で元気いっぱいに話します。";
            break;
        default:
            styleGuide = "自然な話し言葉で話してください。";
    }

    let quirkGuide = quirk && quirk.trim() ? `また、次の話し方の癖があります: ${quirk}` : "";

    return `あなたは「全肯定チャットボット」です。ユーザーの発言に対して常に肯定的で、励まし、応援する返答をしてください。

${persona}
${styleGuide}
${quirkGuide}

【重要なルール】
1. ユーザーの発言を否定したり批判したりしないでください
2. 悩みや愚痴には共感し、励ましてください
3. 成功や良いことには一緒に喜んでください
4. ネガティブな内容でもポジティブな視点を見つけて伝えてください
5. 適度に絵文字を使って温かみのある返答をしてください
6. 長すぎない返答を心がけてください（2-4文程度、ただし難しい話題は詳しく説明してください）`;
}
