const r1cs2plonk = require("./r1cs2plonk.js");
const { getCustomGatesInfo, calculatePlonkConstraintsRowsCompressor, calculatePlonkConstraintsRowsFinalCompressor, calculatePlonkConstraintsRowsCompressorLight } = require("./compressor_helpers.js");

module.exports.getCompressorConstraints = function getCompressorConstraints(r1cs) {
    // Calculate the number plonk Additions and plonk constraints from the R1CS
    const [plonkConstraints, plonkAdditions] = r1cs2plonk(r1cs);

    console.log(`Number of plonk constraints: ${plonkConstraints.length}`);

    // Get information about the custom gates from the R1CS
    const customGatesInfo = getCustomGatesInfo(r1cs);
    
    // Each Poseidon2 gate uses 5 rows
    let nCMulRows = Math.ceil(customGatesInfo.nCMul/3);
    let nPoseidon12Rows = customGatesInfo.nPoseidon12*5;
    let nCustPoseidon12Rows = customGatesInfo.nCustPoseidon12*5;
    let nTotalPoseidon12Rows = nPoseidon12Rows + nCustPoseidon12Rows;
    let nFFT4Rows = customGatesInfo.nFFT4;
    let nEvPol4Rows = customGatesInfo.nEvPol4;
    let nTreeSelector4Rows = customGatesInfo.nTreeSelector4;
    let nSelectVal1Rows = customGatesInfo.nSelectVal1;
    
    // Calculate how many groups of two plonk constraints can be made 
    const CPlonkConstraints = calculatePlonkConstraintsRowsCompressor(plonkConstraints, (customGatesInfo.nPoseidon12 + customGatesInfo.nCustPoseidon12)*3, customGatesInfo.nCustPoseidon12 + customGatesInfo.nPoseidon12 + nTreeSelector4Rows, customGatesInfo.nEvPol4, customGatesInfo.nCustPoseidon12 + customGatesInfo.nPoseidon12 + nSelectVal1Rows);

    customGatesInfo.nPlonkRows = CPlonkConstraints;

    let NUsed = CPlonkConstraints + nCMulRows + nTotalPoseidon12Rows + nFFT4Rows + nEvPol4Rows + nTreeSelector4Rows + nSelectVal1Rows;
    

    console.log(`Number of CMul: ${customGatesInfo.nCMul} -> Constraints: ${nCMulRows}`);
    console.log(`Number of Poseidon2 sponge: ${customGatesInfo.nPoseidon12} -> Constraints: ${nPoseidon12Rows}`);
    console.log(`Number of Poseidon2 compressor: ${customGatesInfo.nCustPoseidon12} -> Constraints: ${nCustPoseidon12Rows}`)
    console.log(`Total Number of Poseidon2:  ${customGatesInfo.nPoseidon12 + customGatesInfo.nCustPoseidon12} -> Constraints ${nTotalPoseidon12Rows}`);
    console.log(`Number of FFT4: ${customGatesInfo.nFFT4} -> Constraints: ${nFFT4Rows}`);
    console.log(`Number of EvPol4: ${customGatesInfo.nEvPol4} -> Constraints: ${nEvPol4Rows}`);
    console.log(`Number of TreeSelector4: ${customGatesInfo.nTreeSelector4} -> Constraints: ${nTreeSelector4Rows}`);
    console.log(`Number of SelectVal1: ${customGatesInfo.nSelectVal1} -> Constraints: ${nSelectVal1Rows}`);

    return {plonkConstraints, plonkAdditions, customGatesInfo, NUsed};
}


module.exports.getCompressorLightConstraints = function getCompressorLightConstraints(r1cs) {
    // Calculate the number plonk Additions and plonk constraints from the R1CS
    const [plonkConstraints, plonkAdditions] = r1cs2plonk(r1cs);

    console.log(`Number of plonk constraints: ${plonkConstraints.length}`);

    // Get information about the custom gates from the R1CS
    const customGatesInfo = getCustomGatesInfo(r1cs);
    
    let nCMulRows = customGatesInfo.nCMul;
    let nPoseidon12Rows = customGatesInfo.nPoseidon12*14;
    let nCustPoseidon12Rows = customGatesInfo.nCustPoseidon12*14;
    let nTotalPoseidon12Rows = nPoseidon12Rows + nCustPoseidon12Rows;
    let nFFT4Rows = 2*customGatesInfo.nFFT4;
    let nEvPol4Rows = 2*customGatesInfo.nEvPol4;
    let nTreeSelector4Rows = 2*customGatesInfo.nTreeSelector4;
    
    // Calculate how many groups of two plonk constraints can be made 
    const CPlonkConstraints = calculatePlonkConstraintsRowsCompressorLight(plonkConstraints);

    customGatesInfo.nPlonkRows = CPlonkConstraints;

    let NUsed = CPlonkConstraints + nCMulRows + nTotalPoseidon12Rows + nFFT4Rows + nEvPol4Rows + nTreeSelector4Rows;
    

    console.log(`Number of CMul: ${customGatesInfo.nCMul} -> Constraints: ${nCMulRows}`);
    console.log(`Number of Poseidon2 sponge: ${customGatesInfo.nPoseidon12} -> Constraints: ${nPoseidon12Rows}`);
    console.log(`Number of Poseidon2 compressor: ${customGatesInfo.nCustPoseidon12} -> Constraints: ${nCustPoseidon12Rows}`)
    console.log(`Total Number of Poseidon:  ${customGatesInfo.nPoseidon12 + customGatesInfo.nCustPoseidon12} -> Constraints ${nTotalPoseidon12Rows}`);
    console.log(`Number of FFT4: ${customGatesInfo.nFFT4} -> Constraints: ${nFFT4Rows}`);
    console.log(`Number of EvPol4: ${customGatesInfo.nEvPol4} -> Constraints: ${nEvPol4Rows}`);
    console.log(`Number of TreeSelector4: ${customGatesInfo.nTreeSelector4} -> Constraints: ${nTreeSelector4Rows}`);

    return {plonkConstraints, plonkAdditions, customGatesInfo, NUsed};
}

module.exports.getFinalCompressorConstraints = function getFinalCompressorConstraints(r1cs) {
    // Calculate the number plonk Additions and plonk constraints from the R1CS
    const [plonkConstraints, plonkAdditions] = r1cs2plonk(r1cs);

    console.log(`Number of plonk constraints: ${plonkConstraints.length}`);

    // Get information about the custom gates from the R1CS
    const customGatesInfo = getCustomGatesInfo(r1cs);
    
    // Each Poseidon2 gate uses 5 rows
    let nCMulRows = Math.ceil(customGatesInfo.nCMul/3);
    let nPoseidon12Rows = customGatesInfo.nPoseidon12*5;
    let nCustPoseidon12Rows = customGatesInfo.nCustPoseidon12*5;
    let nTotalPoseidon12Rows = nPoseidon12Rows + nCustPoseidon12Rows;
    let nFFT4Rows = customGatesInfo.nFFT4;
    let nEvPol4Rows = customGatesInfo.nEvPol4;
    let nTreeSelector4Rows = customGatesInfo.nTreeSelector4;
    let nSelectVal1Rows = customGatesInfo.nSelectVal1;
    
    // Calculate how many groups of two plonk constraints can be made 
    const CPlonkConstraints = calculatePlonkConstraintsRowsFinalCompressor(plonkConstraints, (customGatesInfo.nPoseidon12 + customGatesInfo.nCustPoseidon12)*3, customGatesInfo.nCustPoseidon12 + customGatesInfo.nPoseidon12 + nTreeSelector4Rows, customGatesInfo.nEvPol4, customGatesInfo.nCustPoseidon12 + customGatesInfo.nPoseidon12 + nSelectVal1Rows);

    customGatesInfo.nPlonkRows = CPlonkConstraints;

    let NUsed = CPlonkConstraints + nCMulRows + nTotalPoseidon12Rows + nFFT4Rows + nEvPol4Rows + nTreeSelector4Rows + nSelectVal1Rows;
    

    console.log(`Number of CMul: ${customGatesInfo.nCMul} -> Constraints: ${nCMulRows}`);
    console.log(`Number of Poseidon2 sponge: ${customGatesInfo.nPoseidon12} -> Constraints: ${nPoseidon12Rows}`);
    console.log(`Number of Poseidon2 compressor: ${customGatesInfo.nCustPoseidon12} -> Constraints: ${nCustPoseidon12Rows}`)
    console.log(`Total Number of Poseidon2:  ${customGatesInfo.nPoseidon12 + customGatesInfo.nCustPoseidon12} -> Constraints ${nTotalPoseidon12Rows}`);
    console.log(`Number of FFT4: ${customGatesInfo.nFFT4} -> Constraints: ${nFFT4Rows}`);
    console.log(`Number of EvPol4: ${customGatesInfo.nEvPol4} -> Constraints: ${nEvPol4Rows}`);
    console.log(`Number of TreeSelector4: ${customGatesInfo.nTreeSelector4} -> Constraints: ${nTreeSelector4Rows}`);
    console.log(`Number of SelectVal1: ${customGatesInfo.nSelectVal1} -> Constraints: ${nSelectVal1Rows}`);

    return {plonkConstraints, plonkAdditions, customGatesInfo, NUsed};
}