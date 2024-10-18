
module.exports.publics2zkin = function publics2zkin(airgroupId, zkin, vadcopInfo, publics, isAggregated) {
    let p = 0;
    zkin.sv_aggregationTypes = [];
    for(let i = 0; i < vadcopInfo.aggTypes[airgroupId].length; ++i) {
        zkin.sv_aggregationTypes.push(publics[p++]);
    }
    zkin.sv_circuitType = publics[p++];
    zkin.sv_airgroupValues = [];
    for(let i = 0; i < vadcopInfo.aggTypes[airgroupId].length; ++i) {
        zkin.sv_airgroupValues.push([publics[p++], publics[p++], publics[p++]]);
    }
    zkin.sv_rootC = [publics[p++], publics[p++], publics[p++], publics[p++]];
    for(let i = 0; i <vadcopInfo.numChallenges.length + 1; ++i) {
        zkin[`sv_root${i+1}`] = [publics[p++], publics[p++], publics[p++], publics[p++]];
    }
    
    zkin.sv_evalsHash = [publics[p++], publics[p++], publics[p++], publics[p++]];

    for(let i = 0; i < vadcopInfo.stepsFRI.length - 1; ++i) {
        zkin[`sv_s${i+1}_root`] = [publics[p++], publics[p++], publics[p++], publics[p++]];
    }

    zkin.sv_finalPolHash = [publics[p++], publics[p++], publics[p++], publics[p++]];

    if(!isAggregated) {
        zkin.publics = [];
        for(let i = 0; i < vadcopInfo.nPublics; ++i) {
            zkin.publics.push(publics[p++]);
        }

        zkin.challenges = [];
        for(let i = 0; i < vadcopInfo.numChallenges.reduce((nc, acc) => nc + acc, 0) + 4; ++i) {
            zkin.challenges.push([publics[p++], publics[p++], publics[p++]]);
        }

        zkin.challengesFRISteps = [];
        for(let i = 0; i < vadcopInfo.stepsFRI.length + 1; ++i) {
            zkin.challengesFRISteps.push([publics[p++], publics[p++], publics[p++]]);
        }
    }

    return zkin;
}

module.exports.nullpublics2zkin = function nullpublics2zkin(airgroupId, zkin, vadcopInfo) {
    zkin.sv_circuitType = "0";
    zkin.sv_aggregationTypes = [];
    for(let i = 0; i < vadcopInfo.aggTypes[airgroupId].length; ++i) {
        zkin.sv_aggregationTypes.push(vadcopInfo.aggTypes[airgroupId][i].aggType);
    }
    zkin.sv_airgroupValues = new Array(vadcopInfo.aggTypes[airgroupId].length).fill(["0", "0", "0"]);
    zkin.sv_rootC = ["0", "0", "0", "0"];
    for(let i = 0; i < vadcopInfo.numChallenges.length + 1; ++i) {
        zkin[`sv_root${i+1}`] = ["0", "0", "0", "0"];
    }
    zkin.sv_evalsHash = ["0", "0", "0", "0"];
    for(let i = 0; i < vadcopInfo.stepsFRI.length - 1; ++i) {
        zkin[`sv_s${i+1}_root`] = ["0", "0", "0", "0"];
    }
    zkin.sv_finalPolHash = ["0", "0", "0", "0"];
    return zkin;
}