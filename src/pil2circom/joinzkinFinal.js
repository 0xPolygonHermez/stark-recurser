module.exports.joinzkinFinal = function joinzkinFinal(proofsByAirgroupId, globalInfo, publics, challenges, challengesFRISteps) {
    const zkinFinal = {};

    zkinFinal.publics = publics;
    zkinFinal.challenges = challenges.flat();
    zkinFinal.challengesFRISteps = challengesFRISteps;

    for(let i = 0; i < proofsByAirgroupId.length; ++i) {
        const zkin = proofsByAirgroupId[i].zkinFinal;
        const starkInfo = proofsByAirgroupId[i].starkInfoRecursive2;
        const nStages = Number(starkInfo.nStages) + 1;

        for (let j = 0; j < nStages; ++j) {
            zkinFinal[`s${i}_root${j + 1}`] = zkin[`root${j + 1}`];
        }

        for (let j = 0; j < nStages; ++j) {
            if(starkInfo.mapSectionsN[`cm${j + 1}`] > 0) {
                zkinFinal[`s${i}_s0_vals${j + 1}`] = zkin[`s0_vals${j + 1}`];
            }
        }

        zkinFinal[`s${i}_s0_valsC`] = zkin.s0_valsC; 

        for (let j = 0; j < nStages; ++j) {
            if(starkInfo.mapSectionsN[`cm${j + 1}`] > 0) {
                zkinFinal[`s${i}_s0_siblings${j + 1}`] = zkin[`s0_siblings${j + 1}`];
            } 
        }

        zkinFinal[`s${i}_s0_siblingsC`] = zkin.s0_siblingsC;

        zkinFinal[`s${i}_evals`] = zkin.evals; 

        for (let j = 1; j < starkInfo.starkStruct.steps.length; ++j) {
            zkinFinal[`s${i}_s${j}_root`] = zkin[`s${j}_root`];
            zkinFinal[`s${i}_s${j}_vals`] = zkin[`s${j}_vals`]; 
            zkinFinal[`s${i}_s${j}_siblings`] = zkin[`s${j}_siblings`];  
        }

        zkinFinal[`s${i}_finalPol`] = zkin.finalPol; 

        zkinFinal[`s${i}_sv_circuitType`] = zkin.sv_circuitType;
        zkinFinal[`s${i}_sv_aggregationTypes`] = zkin.sv_aggregationTypes;
        zkinFinal[`s${i}_sv_airgroupValues`] = zkin.sv_airgroupValues;

        zkinFinal[`s${i}_sv_rootC`] = zkin.sv_rootC;
        for(let j = 0; j < globalInfo.numChallenges.length + 1; ++j) {
            zkinFinal[`s${i}_sv_root${j + 1}`] = zkin[`sv_root${j + 1}`];
        }
        zkinFinal[`s${i}_sv_evalsHash`] = zkin.sv_evalsHash;
        
        for(let j = 0; j < globalInfo.stepsFRI.length - 1; ++j) {
            zkinFinal[`s${i}_sv_s${j+1}_root`] = zkin[`sv_s${j+1}_root`];
        }

        zkinFinal[`s${i}_sv_finalPolHash`] = zkin.sv_finalPolHash;
    }

    return zkinFinal;
}