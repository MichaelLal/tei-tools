import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
You are an expert TEI (Text Encoding Initiative) specialist and strict XML validator. 
Your goal is to help users learn TEI tagging by rigorously reviewing their XML snippets, identifying structural and syntax errors, checking for improper tags, and providing explicit corrections.

### Your Responsibilities:
1. **Syntax & Structure Verification**: Strictly verify that the XML snippet is well-formed. Identify ANY missing children, improper nesting, or syntax errors.
2. **Improper Tags Identification**: Identify any tags or attributes that are used incorrectly or do not exist in the provided schema. Clearly point them out.
3. **Specific Corrections**: When a mistake is found (syntax, structure, or improper tag), DO NOT just point out the error. You MUST provide the exact, corrected XML snippet to replace the erroneous code.
4. **Accuracy Check**: Verify if the tags are used correctly in the given context (e.g., is a <persName> actually a person?).
5. **Suggestions for Richness**: Point out untagged text that should be tagged based on the schema (e.g., untagged dates or locations).

### Response Format:
- Use clear headings (e.g., "Syntax Errors", "Improper Tags", "Corrections").
- Provide exact XML snippets showing the "Incorrect" vs "Correct" usage.
- Be explicitly detailed about *why* the structure or syntax is wrong.
- Always cross-reference the user's custom TEI Schema tags provided below.

### Context:
The user is using a custom TEI tool designed for historical document annotation and requires strict, actionable feedback.
`;

export const getGeminiFeedback = async (apiKey, xmlSnippet, availableTags = [], modelName = "gemini-1.5-flash") => {
  if (!apiKey) throw new Error("API Key is required to use the Gemini AI.");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const tagsContext = availableTags.map(t => `- <${t.id}>: ${t.descriptions?.en || t.desc || 'No description'}`).join('\n');
  
  const prompt = `
### Available Tags (Defined by the user's custom TEI Schema):
${tagsContext}

Please analyze the following TEI XML snippet and provide a detailed educational breakdown based on your system instructions. Ensure any suggestions you make strictly use the tags explicitly allowed in the schema above:

\`\`\`xml
${xmlSnippet}
\`\`\`
`;

  // Try v1 first, then fallback to v1beta if 404 occurs
  const versions = ['v1', 'v1beta'];
  let lastError = null;

  for (const version of versions) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: version });
      const result = await model.generateContent([SYSTEM_PROMPT, prompt]);
      const response = await result.response;
      return response.text();
    } catch (error) {
      lastError = error;
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        continue;
      }
      break;
    }
  }

  throw new Error(`AI Feedback failed: ${lastError.message}`);
};

export const getGeminiSuggestions = async (apiKey, text, availableTags = [], modelName = "gemini-1.5-flash") => {
  if (!apiKey) throw new Error("API Key is required to use the Gemini AI.");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const tagsContext = availableTags.map(t => `- <${t.id}>: ${t.descriptions?.en || t.desc || 'No description'}`).join('\n');
  
  const SUGGESTION_PROMPT = `
You are an expert TEI (Text Encoding Initiative) specialist. 
Your goal is to help users learn TEI tagging by reviewing their raw manuscript text and suggesting what they should tag next.

### Available Tags (Defined by their custom TEI Schema):
${tagsContext}

### Your Responsibilities:
Review the user's raw text below and suggest 3 to 5 specific words or phrases that should be tagged, strictly using ONLY the tags listed in the "Available Tags" section. For each suggestion, provide:
1. The exact word or phrase from the text.
2. The recommended tag (e.g., <placeName>).
3. A brief explanation of WHY it should be tagged, based strictly on the custom tag definition provided above.

Format your response as a helpful markdown list. Keep it concise, friendly, and educational.

### Raw Text:
\`\`\`text
${text}
\`\`\`
`;
  // Log prompt for debugging if needed in development
  // console.log(SUGGESTION_PROMPT);


  const versions = ['v1', 'v1beta'];
  let lastError = null;

  for (const version of versions) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: version });
      const result = await model.generateContent([SUGGESTION_PROMPT]);
      const response = await result.response;
      return response.text();
    } catch (error) {
      lastError = error;
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        continue;
      }
      break;
    }
  }

  throw new Error(`AI Suggestion failed: ${lastError.message}`);
};

export const getGeminiAutoAnnotations = async (apiKey, text, availableTags = [], modelName = "gemini-2.5-flash") => {
  if (!apiKey) throw new Error("API Key is required to use the Gemini AI.");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const tagsContext = availableTags.map(t => `- <${t.id}>: ${t.descriptions?.en || t.desc || 'No description'}`).join('\n');
  
  const AUTO_ANNOTATE_PROMPT = `
You are an expert TEI (Text Encoding Initiative) specialist. 
Your goal is to automatically find and tag all relevant entities in the provided raw text using ONLY the "Available Tags".

### Available Tags (Defined by their custom TEI Schema):
${tagsContext}

### Your Responsibilities:
1. Scan the text for every entity that strongly matches the available tags.
2. Return ONLY a valid JSON array of objects, with no markdown formatting around it. Do not include \`\`\`json.
3. Each object must strictly have:
   - "text": The exact string from the raw text to be highlighted.
   - "type": The exact tag ID from the Available Tags.

### Response Format:
[{ "text": "Dublin", "type": "placeName" }, { "text": "Patrick", "type": "persName" }]

### Raw Text:
${text}
`;

  const versions = ['v1', 'v1beta'];
  let lastError = null;

  for (const version of versions) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: version });
      const result = await model.generateContent([AUTO_ANNOTATE_PROMPT]);
      const response = await result.response;
      return response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
    } catch (error) {
      lastError = error;
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        continue;
      }
      break;
    }
  }

  throw new Error(`AI Auto-Annotation failed: ${lastError.message}`);
};
