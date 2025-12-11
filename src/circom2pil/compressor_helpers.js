const { assert } = require("chai");

module.exports ={
    calculatePlonkConstraintsRowsFinalCompressor: function(plonkConstraints, tenExtraConstraints, fourExtraConstraints, threeExtraConstraints, twoExtraConstraints) {
        let partialRows = {};
        let halfRows = [];
        let r = 0;

        let constraintsCustomRows = 0;
        let constraintsPlonkRows = 0;
        for (let i=0; i<plonkConstraints.length; i++) {
            if ((i%10000) == 0) {
                console.log(`Point Check -> Plonk info constraint processing... ${i}/${plonkConstraints.length}`);
            }
            //Each plonkConstraint has the following form: [a,b,c, qM, qL, qR, qO, qC]
            const c = plonkConstraints[i]; 
            const k= c.slice(3, 8).map( a=> a.toString(16)).join(","); //Calculate
            if(partialRows[k]) {
                if(partialRows[k].custom) {
                    constraintsCustomRows++;
                } else {
                    constraintsPlonkRows++;
                }
                ++partialRows[k].nUsed;
                if(partialRows[k].nUsed == partialRows[k].maxUsed) {
                    delete partialRows[k];
                }
            } else if(halfRows.length > 0) {
                partialRows[k] = halfRows.shift();
                partialRows[k].nUsed++;
                if(partialRows[k].custom) {
                    constraintsCustomRows++;
                } else {
                    constraintsPlonkRows++;
                }
            } else if(tenExtraConstraints > 0) {
                --tenExtraConstraints;
                partialRows[k] = {nUsed: 1, custom: true, maxUsed: 2};
                halfRows.push({nUsed: 2, custom: true, maxUsed: 10});
                constraintsCustomRows++;
            } else if(fourExtraConstraints > 0) {
                --fourExtraConstraints;
                partialRows[k] = {nUsed: 7, custom: true, maxUsed: 10};
                constraintsCustomRows++;
            } else if(threeExtraConstraints > 0) {
                --threeExtraConstraints;
                partialRows[k] = {nUsed: 8, custom: true, maxUsed: 10};
                constraintsCustomRows++;
            } else if(twoExtraConstraints > 0) {
                --twoExtraConstraints;
                partialRows[k] = {nUsed: 9, custom: true, maxUsed: 10};
                constraintsCustomRows++;
            } else {
                partialRows[k] = {nUsed: 1, custom: false, maxUsed: 2};
                halfRows.push({nUsed: 2, custom: false, maxUsed: 10});
                constraintsPlonkRows++;
                r++;
            }
        };

        console.log(`Number of totalplonk constraints: ${plonkConstraints.length}`); 
        console.log(`Number of Plonk constraints stored in rows -> ${constraintsPlonkRows} in ${r} rows`);
        console.log(`Number of plonk constraints stored in custom gates: ${constraintsCustomRows}`);

        return r;
    },

    calculatePlonkConstraintsRowsCompressorLight: function(plonkConstraints) {
        let partialRows = {};
        let halfRows = [];
        let r = 0;

        let constraintsPlonkRows = 0;
        for (let i=0; i<plonkConstraints.length; i++) {
            if ((i%10000) == 0) {
                console.log(`Point Check -> Plonk info constraint processing... ${i}/${plonkConstraints.length}`);
            }
            //Each plonkConstraint has the following form: [a,b,c, qM, qL, qR, qO, qC]
            const c = plonkConstraints[i]; 
            const k= c.slice(3, 8).map( a=> a.toString(16)).join(","); //Calculate
            if(partialRows[k]) {
                constraintsPlonkRows++;
                ++partialRows[k].nUsed;
                if(partialRows[k].nUsed === 2 || partialRows[k].nUsed === 4) {
                    delete partialRows[k];
                }
            } else if(halfRows.length > 0) {
                partialRows[k] = halfRows.shift();
                partialRows[k].nUsed++;
                constraintsPlonkRows++;
            } else {
                partialRows[k] = {nUsed: 1, custom: false, maxUsed: 2};
                halfRows.push({nUsed: 2, custom: false, maxUsed: 4});
                constraintsPlonkRows++;
                r++;
            }
        };

        console.log(`Number of totalplonk constraints: ${plonkConstraints.length}`); 
        console.log(`Number of Plonk constraints stored in rows -> ${constraintsPlonkRows} in ${r} rows`);

        return r;
    },

    calculatePlonkConstraintsRowsCompressor: function(plonkConstraints, nineExtraConstraints, threeExtraConstraints, twoExtraConstraints, oneExtraConstraint) {
        let partialRows = {};
        let halfRows = [];
        let r = 0;

        let constraintsCustomRows = 0;
        let constraintsPlonkRows = 0;
        for (let i=0; i<plonkConstraints.length; i++) {
            if ((i%10000) == 0) {
                console.log(`Point Check -> Plonk info constraint processing... ${i}/${plonkConstraints.length}`);
            }
            //Each plonkConstraint has the following form: [a,b,c, qM, qL, qR, qO, qC]
            const c = plonkConstraints[i]; 
            const k= c.slice(3, 8).map( a=> a.toString(16)).join(","); //Calculate
            if(partialRows[k]) {
                if(partialRows[k].custom) {
                    constraintsCustomRows++;
                } else {
                    constraintsPlonkRows++;
                }
                ++partialRows[k].nUsed;
                if(partialRows[k].nUsed === 2 || partialRows[k].nUsed === 9 || partialRows[k].nUsed == partialRows[k].maxUsed) {
                    delete partialRows[k];
                }
            } else if(halfRows.length > 0) {
                partialRows[k] = halfRows.shift();
                partialRows[k].nUsed++;
                if(partialRows[k].custom) {
                    constraintsCustomRows++;
                } else {
                    constraintsPlonkRows++;
                }
            } else if(nineExtraConstraints > 0) {
                --nineExtraConstraints;
                partialRows[k] = {nUsed: 1, custom: true, maxUsed: 2};
                halfRows.push({nUsed: 2, custom: true, maxUsed: 9});
                constraintsCustomRows++;
            } else if(threeExtraConstraints > 0) {
                --threeExtraConstraints;
                partialRows[k] = {nUsed: 7, custom: true, maxUsed: 9};
                constraintsCustomRows++;
            } else if(twoExtraConstraints > 0) {
                --twoExtraConstraints;
                partialRows[k] = {nUsed: 8, custom: true, maxUsed: 9};
                constraintsCustomRows++;
            } else if(oneExtraConstraint > 0) {
                --oneExtraConstraint;
                constraintsCustomRows++;
            } else {
                partialRows[k] = {nUsed: 1, custom: false, maxUsed: 2};
                halfRows.push({nUsed: 2, custom: false, maxUsed: 9});
                constraintsPlonkRows++;
                r++;
            }
        };

        console.log(`Number of totalplonk constraints: ${plonkConstraints.length}`); 
        console.log(`Number of Plonk constraints stored in rows -> ${constraintsPlonkRows} in ${r} rows`);
        console.log(`Number of plonk constraints stored in custom gates: ${constraintsCustomRows}`);

        return r;
    },

    /*
        Given the R1CS, return how many custom gates of each kind are used
    */ 
    getCustomGatesInfo: function(r1cs) {
        
        // Store the different types of custom gates that are being used and how many times each
        const res = {
            Poseidon12Id: 0,
            CustPoseidon12Id: 0,
            CMulAddId: 0,
            CMulId:0,
            FFT4Parameters: {},
            EvPol4Id: 0,
            TreeSelector4Id: 0,
            SelectVal1Id: 0,
            nCMulAdd: 0,
            nCMul:0,
            nPoseidon12: 0,
            nCustPoseidon12: 0,
            nFFT4: 0,
            nEvPol4: 0,
            nTreeSelector4: 0,
            nSelectVal1: 0
        }
    
        // Each custom gate in the r1cs has the following structure: {templateName: "Poseidon2", parameters: []}
        // Notice that none of the custom gates will have parameters except for the FFT
        // Each FFT4 needs 4 parameters: scale, firstW, firstW2 and incW that have to be defined in order to use the custom template
        // Therefore, each FFT that uses a different set of parameters will be stored as a different custom gate in the r1cs and so
        // we will have 1 custom gate for CMulAdd, Poseidon2 and EvPol4 and many for FFT4
        for (let i=0; i<r1cs.customGates.length; i++) {
            switch (r1cs.customGates[i].templateName) {
                case "CMul":
                    res.CMulId =i;
                    assert(r1cs.customGates[i].parameters.length == 0);
                    break;
                case "Poseidon16":
                    res.Poseidon12Id =i;
                    break;
                case "CustPoseidon16":
                    res.CustPoseidon12Id =i;
                    break;
                case "EvPol4":
                    res.EvPol4Id =i;
                    assert(r1cs.customGates[i].parameters.length == 0);
                    break;
                case "TreeSelector4":
                    res.TreeSelector4Id =i;
                    assert(r1cs.customGates[i].parameters.length == 0);
                    break;
                case "SelectValue1":
                    res.SelectVal1Id =i;
                    assert(r1cs.customGates[i].parameters.length == 0);
                    break;
                case "FFT4":
                    res.FFT4Parameters[i] = r1cs.customGates[i].parameters; 
                    break;
                default:
                    throw new Error("Invalid custom gate: " + r1cs.customGates[i].templateName);
            }
        }
    
        // Store how many times each custom gates is used
        for (let i=0; i< r1cs.customGatesUses.length; i++) {
            if (r1cs.customGatesUses[i].id == res.CMulId) {
                res.nCMul ++;
            } else if (r1cs.customGatesUses[i].id == res.Poseidon12Id) {
                res.nPoseidon12 ++;
            } else if (r1cs.customGatesUses[i].id == res.CustPoseidon12Id) {
                res.nCustPoseidon12 ++;
            } else if (typeof res.FFT4Parameters[r1cs.customGatesUses[i].id] !== "undefined") {
                res.nFFT4 ++;
            } else if (r1cs.customGatesUses[i].id == res.EvPol4Id) {
                res.nEvPol4 ++;
            } else if (r1cs.customGatesUses[i].id == res.TreeSelector4Id) {
                res.nTreeSelector4 ++;
            } else if (r1cs.customGatesUses[i].id == res.SelectVal1Id) {
                res.nSelectVal1 ++;
            } else {
                throw new Error("Custom gate not defined" + r1cs.customGatesUses[i].id);
            }
        }

        return res;
    }
}



