export const knowledgeBase = `
% Facts: crop_conditions(Crop, SoilType, Rainfall, Climate, Season, Ph, Water, Confidence, Reason)

% WHEAT
crop_conditions(wheat, loamy, medium, cool, rabi, neutral, moderate, 95, 'Optimal conditions: Loamy neutral soil with moderate water availability is perfect. Cool Rabi season supports tillering.').
crop_conditions(wheat, clay, low, cool, rabi, alkaline, moderate, 85, 'Good conditions: Clay soil compensates for low rainfall. Wheat tolerates slightly alkaline soil well.').
crop_conditions(wheat, sandy, medium, cool, rabi, acidic, plentiful, 60, 'Sub-optimal: Sandy soil drains too fast, and acidic conditions stunt root growth.').

% RICE
crop_conditions(rice, clay, high, warm, kharif, acidic, plentiful, 98, 'Optimal conditions: Clay soil holds standing water perfectly. Tolerates acidic soil. Warm Kharif weather drives rapid growth.').
crop_conditions(rice, loamy, high, warm, kharif, neutral, plentiful, 85, 'Good conditions: Loamy soil is acceptable but requires more water input to maintain flooding.').

% COTTON
crop_conditions(cotton, black, medium, warm, kharif, alkaline, moderate, 95, 'Optimal conditions: Black alkaline soil is famous for its moisture retention. Warm weather is ideal for boll development.').
crop_conditions(cotton, sandy, medium, warm, kharif, neutral, scarce, 70, 'Marginal conditions: Requires heavy fertilization and careful water management in sandy soil.').

% MAIZE
crop_conditions(maize, loamy, medium, warm, kharif, neutral, moderate, 90, 'Optimal conditions: Loamy soil provides good drainage. Maize thrives in warm climates with moderate, well-distributed rain.').
crop_conditions(maize, red, medium, warm, kharif, acidic, moderate, 80, 'Good conditions: Red soil is acceptable, slightly acidic conditions are tolerated well.').
crop_conditions(maize, clay, high, warm, kharif, alkaline, plentiful, 50, 'Risk: Heavy clay with plentiful water can cause waterlogging, stunting maize roots.').

% SUGARCANE
crop_conditions(sugarcane, loamy, high, warm, kharif, neutral, plentiful, 95, 'Optimal conditions: Plentiful water availability and warm temperatures support continuous biomass accumulation.').
crop_conditions(sugarcane, clay, high, humid, rabi, alkaline, plentiful, 90, 'Good conditions: Clay soil and high humidity support cane growth even in Rabi.').

% MUSTARD
crop_conditions(mustard, sandy, low, cool, rabi, neutral, scarce, 92, 'Optimal conditions: Requires very little water. Sandy soil prevents root rot. Cool weather is ideal.').
crop_conditions(mustard, loamy, low, cool, rabi, alkaline, scarce, 88, 'Good conditions: Loamy soil is excellent, provided there is no waterlogging.').

% GROUNDNUT
crop_conditions(groundnut, sandy, low, warm, kharif, neutral, scarce, 95, 'Optimal conditions: Sandy soil is critical for pegging. Scarce water prevents fungal diseases. Warm weather accelerates growth.').
crop_conditions(groundnut, red, medium, warm, kharif, acidic, moderate, 85, 'Good conditions: Red soil is loose enough for peg penetration.').

% MILLET
crop_conditions(millet, sandy, low, arid, kharif, acidic, scarce, 98, 'Optimal conditions: Extremely drought resistant. Thrives in sandy soils, acidic conditions, and arid climates.').
crop_conditions(millet, red, low, arid, kharif, alkaline, scarce, 90, 'Good conditions: Drought hardy and performs well in poor soils.').

% Rules
recommend_crop(Crop, Soil, Rainfall, Climate, Season, Ph, Water, Confidence, Reason) :-
    crop_conditions(Crop, Soil, Rainfall, Climate, Season, Ph, Water, Confidence, Reason).
`;
