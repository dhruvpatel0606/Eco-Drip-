import { knowledgeBase } from '../prolog/knowledge_base';

export interface PrologResult {
    crop: string;
    confidence: number;
    reason: string;
}

export const runPrologQuery = (soil: string, rainfall: string, climate: string, season: string, ph: string, water: string): Promise<PrologResult[]> => {
    return new Promise((resolve) => {
        // @ts-ignore
        const pl = window.pl;
        if (!pl) {
            console.error("Tau Prolog not loaded from CDN.");
            resolve([]);
            return;
        }

        const session = pl.create(1000);
        
        session.consult(knowledgeBase, {
            success: function() {
                const query = `recommend_crop(Crop, S, R, C, Se, P, W, Conf, Reason).`;
                session.query(query, {
                    success: function() {
                        const results: PrologResult[] = [];
                        const seen = new Set();
                        
                        const getAnswers = () => {
                            session.answer({
                                success: function(answer: any) {
                                    const formatted = session.format_answer(answer);
                                    
                                    const matchVal = (regex: RegExp) => { 
                                        const m = formatted.match(regex); 
                                        return m && m[1] ? m[1].toLowerCase() : ''; 
                                    };
                                    const matchReason = (regex: RegExp) => { 
                                        const m = formatted.match(regex); 
                                        return m && m[1] ? m[1] : ''; 
                                    };
                                    
                                    const crop = matchVal(/Crop\s*=\s*['"]?([a-zA-Z0-9_]+)['"]?/);
                                    const confidence = parseInt(matchVal(/Conf\s*=\s*(\d+)/) || '0', 10);
                                    const reason = matchReason(/Reason\s*=\s*(?:'|")?(.*?)(?:'|"|\s*;\s*$)/);
                                    const s = matchVal(/S\s*=\s*([a-zA-Z0-9_]+)/);
                                    const r = matchVal(/R\s*=\s*([a-zA-Z0-9_]+)/);
                                    const c = matchVal(/C\s*=\s*([a-zA-Z0-9_]+)/);
                                    const se = matchVal(/Se\s*=\s*([a-zA-Z0-9_]+)/);
                                    const p = matchVal(/P\s*=\s*([a-zA-Z0-9_]+)/);
                                    const w = matchVal(/W\s*=\s*([a-zA-Z0-9_]+)/);

                                    if (crop && !seen.has(crop)) {
                                        let mismatches = 0;
                                        if (s !== soil.toLowerCase()) mismatches++;
                                        if (r !== rainfall.toLowerCase()) mismatches++;
                                        if (c !== climate.toLowerCase()) mismatches++;
                                        if (se !== season.toLowerCase()) mismatches++;
                                        if (p !== ph.toLowerCase()) mismatches++;
                                        if (w !== water.toLowerCase()) mismatches++;

                                        // Deduct 12% confidence for each mismatched variable to allow partial matches
                                        const finalConf = Math.max(0, confidence - (mismatches * 12));
                                        
                                        if (finalConf >= 20) {
                                            seen.add(crop);
                                            // Prepend the fuzzy match notice to the reason if there are mismatches
                                            const prefix = mismatches > 0 ? `(Partial Match: ${6 - mismatches}/6 factors) ` : '';
                                            results.push({ crop, confidence: finalConf, reason: prefix + reason });
                                        }
                                    }
                                    
                                    getAnswers();
                                },
                                error: function(err: any) {
                                    console.error("Error getting answer", err);
                                    resolve(results);
                                },
                                fail: function() {
                                    resolve(results);
                                },
                                limit: function() {
                                    resolve(results);
                                }
                            });
                        };
                        getAnswers();
                    },
                    error: function(err: any) {
                        console.error("Error querying", err);
                        resolve([]);
                    }
                });
            },
            error: function(err: any) {
                console.error("Error consulting knowledge base", err);
                resolve([]);
            }
        });
    });
};
