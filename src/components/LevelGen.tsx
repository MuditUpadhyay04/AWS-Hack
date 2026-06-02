import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export interface LevelData {
  width: number;
  height: number;
  layout: string[][];
}

// Initialize the AWS Client with Vite environment variables
const client = new BedrockRuntimeClient({
  region: import.meta.env.VITE_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

export async function generateLevelWithBedrock(
  difficulty: string,
  isRisk: boolean,
  domain: string
): Promise<LevelData> {
  const prompt = `You are a 2D platformer level generator engine.
Generate a level layout based on these parameters:
- Difficulty: ${difficulty} (Easy = flat, hard = many gaps/hazards)
- Is Risk/Boss Level: ${isRisk} (If true, include a Bowser/Boss hazard)
- Theme: ${domain}

Rules:
- The output MUST be a strict JSON object. No markdown formatting, no preamble, no explanation.
- Use 'E' for empty space, 'P' for platform, 'H' for hazard, 'O' for objective/exit.
- The layout array MUST be exactly 10 rows by 50 columns. (This is a side-scrolling level).

Example format:
{
  "width": 50,
  "height": 10,
  "layout": [
    ["E", "E", "E", "E", ...],
    ["P", "P", "P", "P", ...]
  ]
}

Generate the JSON now.`;

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  try {
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0", // Claude 3 Haiku
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    
    // Decode the Uint8Array response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    let rawContent = responseBody.content[0].text;

    // Strip markdown formatting if Claude disobeys the prompt
    rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

    return JSON.parse(rawContent) as LevelData;
  } catch (error) {
    console.error("Bedrock generation failed, falling back to default level:", error);
    
    // Fallback so the game doesn't crash if the API fails
    return {
      width: 10,
      height: 5,
      // Written as strings for readability, then split into the string[][] the game expects.
      layout: [
      "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
      "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
      "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
      "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEOE",
      "EEEEEEEEEEEEEEEPPEEEEEEEEEEEEEEEEEEPPEEEEEEEEPPPPP",
      "EEEEEEEPPEEEEEEEEEEEEPPPEEEEEEPPEEEEEEEEEEEPPPPPPP",
      "EEEEEEEEEEEEPPEEEEEEEEEEEEPPEEEEEEPPEEEEEEPPPPPPPP",
      "EEEEEEEEEEEEEEEEEEHHEEEEHHEEEEEEEEEEEEHHEEPPPPPPPP",
      "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
      "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP"
    ].map((row) => row.split("")),
    };
  }
}