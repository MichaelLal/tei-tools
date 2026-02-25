/**
 * Search Utilities ported from uCeltic Python backend.
 * Provides Levenshtein distance, Irish mutations, and window-based similarity search.
 */
// Source: https://gist.github.com/andrei-m/982927
const levenshteinDistance = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

// Global constants for Irish mutations
const INITIAL_MUTATIONS = {
    // nasalisation
    'ng': 'g', 'mb': 'b', 'nd': 'd',
    'na': 'a', 'ne': 'e', 'ni': 'i', 'no': 'o', 'nu': 'u',
    // lenition
    'ch': 'c', 'ph': 'p', 'th': 't',
    'ḟ': 'f', 'fh': 'f', 'ṡ': 's', 'sh': 's',
    // gemination
    'll': 'l', 'nn': 'n', 'rr': 'r', 'mm': 'm', 'ss': 's',
};

/**
 * Apply Irish initial mutations to normalize word forms.
 * @param {string} word - The word to normalize.
 * @returns {string} - The normalized word.
 */
const applyIrishMutations = (word) => {
    if (!word || word.length === 0) return word;

    let normalized = word;

    // Handle special dotted characters (using unicode normalization if necessary, but manual check here)
    if (normalized[0] === 'ḟ') {
        normalized = 'f' + normalized.slice(1);
    } else if (normalized[0] === 'ṡ') {
        normalized = 's' + normalized.slice(1);
    }

    // Handle two-character mutations
    if (normalized.length >= 2) {
        const prefix = normalized.slice(0, 2);
        const replacement = INITIAL_MUTATIONS[prefix];
        if (replacement) {
            normalized = replacement + normalized.slice(2);
        }
    }

    return normalized;
};

/**
 * Tokenize text and return words with their start/end indices.
 * @param {string} text - The input text.
 * @param {boolean} isIrish - Whether to apply Irish normalization.
 * @returns {object} - { words: string[], indices: number[][] }
 */
const tokenizationWithIndex = (text, isIrish = false) => {
    const words = [];
    const indices = [];

    // Regex to match words including Irish characters
    // Matches sequences of letters, including accent vowels and dotted consonants
    const regex = /\b[a-zA-ZḟṡáéíóúÁÉÍÓÚ]+\b/g;

    let match;
    while ((match = regex.exec(text)) !== null) {
        let word = match[0].toLowerCase();
        if (isIrish) {
            word = applyIrishMutations(word);
        }
        words.push(word);
        indices.push([match.index, match.index + match[0].length]);
    }

    return { words, indices };
};

/**
 * Calculate dissimilarity score from distance matrix.
 * Finds the minimum path of matches.
 */
const calculateDissimilarityScore = (matrix, actualWindowSize) => {
    const results = [];
    // Deep copy matrix to avoid mutation if needed, or just work on it directly 
    // (since we create a new one every window step, direct mod is fine)

    // We need to process enough minimums. 
    // The Python logic finds global minimum, records it, then 'crosses out' that row and col.
    // It repeats this loop len(matrix) times (number of target words).

    const rows = matrix.length;
    const cols = matrix[0].length;

    // Helper to check if a value is effectively infinity
    const isInf = (val) => val === Infinity;

    // Work on a copy/mutable version of matrix? 
    // The python code modifies 'matrix' in place inside the loop.
    // 'matrix' is created fresh for each window step in 'movingWindowSimilarity'.

    for (let i = 0; i < rows; i++) {
        let currentMinVal = Infinity;
        let minRow = -1;
        let minCol = -1;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < actualWindowSize; c++) {
                if (matrix[r][c] < currentMinVal) {
                    currentMinVal = matrix[r][c];
                    minRow = r;
                    minCol = c;
                }
            }
        }

        if (minRow === -1) break;

        results.push(currentMinVal);

        // Set row to infinity
        for (let c = 0; c < actualWindowSize; c++) {
            matrix[minRow][c] = Infinity;
        }

        // Set col to infinity
        for (let r = 0; r < rows; r++) {
            matrix[r][minCol] = Infinity;
        }
    }

    return results;
};

/**
 * Core Moving Window Similarity Algorithm.
 */
const movingWindowSimilarity = (targetWords, totalWords, actualWindowSize, step = 1) => {
    if (actualWindowSize > totalWords.length) {
        actualWindowSize = totalWords.length;
    }

    if (totalWords.length === 0 || actualWindowSize === 0) {
        return [{ score: 1.0, index: 0 }];
    }

    const topResults = [];

    for (let i = 0; i <= totalWords.length - actualWindowSize; i += step) {
        // Create matrix: rows = target words, cols = source window words
        // Initialize with Infinity
        const matrix = Array(targetWords.length).fill().map(() => Array(actualWindowSize).fill(Infinity));

        const sourceWords = totalWords.slice(i, i + actualWindowSize);

        for (let k = 0; k < targetWords.length; k++) {
            for (let j = 0; j < sourceWords.length; j++) {
                const dist = levenshteinDistance(targetWords[k], sourceWords[j]);
                const maxLen = Math.max(targetWords[k].length, sourceWords[j].length);
                const score = maxLen === 0 ? 0 : dist / maxLen;
                matrix[k][j] = score;
            }
        }

        const dissimilarityScores = calculateDissimilarityScore(matrix, actualWindowSize);

        // Sum scores and normalize
        const totalScore = dissimilarityScores.reduce((acc, val) => acc + val, 0);
        const normalizedScore = totalScore / targetWords.length;

        topResults.push({ score: normalizedScore, index: i });
    }

    // Sort by score (ascending: lower is check closer match)
    topResults.sort((a, b) => a.score - b.score);
    return topResults;
};

/**
 * Main Search Function.
 * @param {string} text - The full text to search within.
 * @param {string} query - The search query.
 * @param {object} options - { windowSize, stepSize, dissimilarityThreshold, topK, isIrish }
 */
export const performSearch = (text, query, { windowSize = 1.0, stepSize = 1, dissimilarityThreshold = 0.5, topK = 5, isIrish = false } = {}) => {
    if (!text || !query) return [];

    const { words: targetWords } = tokenizationWithIndex(query, isIrish);
    const { words: articleTokens, indices: tokenIndices } = tokenizationWithIndex(text, isIrish);

    if (targetWords.length === 0) return [];

    const actualWindowSize = Math.max(1, Math.floor(targetWords.length * windowSize));

    // Run algorithm
    const topResults = movingWindowSimilarity(targetWords, articleTokens, actualWindowSize, stepSize);

    // Filter and format results
    const filteredResults = [];

    // Take top K *candidate* matches, then verify threshold
    // (Python code takes top_results (all of them sorted), slices top_k, then checks threshold)
    const candidates = topResults.slice(0, topK);

    for (const { score, index } of candidates) {
        if (score <= dissimilarityThreshold) {
            let startPos, endPos, textSnippet;

            // Calculate snippet range
            if (index + actualWindowSize <= articleTokens.length) {
                startPos = tokenIndices[index][0];
                // end of last word in window
                endPos = tokenIndices[index + actualWindowSize - 1][1];
                textSnippet = text.slice(startPos, endPos);
            } else {
                // Fallback (shouldn't happen with correct loop bounds)
                startPos = tokenIndices[index][0];
                textSnippet = text.slice(startPos);
            }

            filteredResults.push({
                text: textSnippet,
                score: score,
                startIndex: startPos,
                endIndex: endPos
            });
        }
    }

    return filteredResults;
};
