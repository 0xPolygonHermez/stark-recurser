const r1cs2plonk = require("./r1cs2plonk.js");
const { getCustomGatesInfo, calculatePlonkConstraintsRowsCompressor, calculatePlonkConstraintsRowsFinalCompressor } = require("./compressor_helpers.js");

module.exports.getCompressorConstraints = function getCompressorConstraints(r1cs) {
    // Calculate the number plonk Additions and plonk constraints from the R1CS
    const [plonkConstraints, plonkAdditions] = r1cs2plonk(r1cs);

    console.log(`Number of plonk constraints: ${plonkConstraints.length}`);

    // Get information about the custom gates from the R1CS
    const customGatesInfo = getCustomGatesInfo(r1cs);
    
    // Each Poseidon12 custom gate uses 6 rows (Input -> Round 2 -> Round 4 -> Round 26 -> Round 28 -> Output)
    let nCMulRows = Math.ceil(customGatesInfo.nCMul/2);
    let nPoseidon12Rows = customGatesInfo.nPoseidon12*6;
    let nCustPoseidon12Rows = customGatesInfo.nCustPoseidon12*6;
    let nTotalPoseidon12Rows = nPoseidon12Rows + nCustPoseidon12Rows;
    let nFFT4Rows = customGatesInfo.nFFT4;
    let nEvPol4Rows = customGatesInfo.nEvPol4;
    let nTreeSelector4Rows = customGatesInfo.nTreeSelector4;
    
    // Calculate how many groups of two plonk constraints can be made 
    const CPlonkConstraints = calculatePlonkConstraintsRowsCompressor(plonkConstraints, customGatesInfo.nCustPoseidon12 + customGatesInfo.nPoseidon12, (customGatesInfo.nPoseidon12 + customGatesInfo.nCustPoseidon12)*3, nCMulRows + nTreeSelector4Rows);

    customGatesInfo.nPlonkRows = CPlonkConstraints;

    let NUsed = CPlonkConstraints + nCMulRows + nTotalPoseidon12Rows + nFFT4Rows + nEvPol4Rows + nTreeSelector4Rows;
    

    console.log(`Number of CMul: ${customGatesInfo.nCMul} -> Constraints: ${nCMulRows}`);
    console.log(`Number of Poseidon12: ${customGatesInfo.nPoseidon12} -> Constraints: ${nPoseidon12Rows}`);
    console.log(`Number of Poseidon12 custom: ${customGatesInfo.nCustPoseidon12} -> Constraints: ${nCustPoseidon12Rows}`)
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
    
    // Each Poseidon12 custom gate uses 6 rows (Input -> Round 2 -> Round 4 -> Round 26 -> Round 28 -> Output)
    let nCMulRows = Math.ceil(customGatesInfo.nCMul/2);
    let nPoseidon12Rows = customGatesInfo.nPoseidon12*6;
    let nCustPoseidon12Rows = customGatesInfo.nCustPoseidon12*6;
    let nTotalPoseidon12Rows = nPoseidon12Rows + nCustPoseidon12Rows;
    let nFFT4Rows = customGatesInfo.nFFT4;
    let nEvPol4Rows = customGatesInfo.nEvPol4;
    let nTreeSelector4Rows = customGatesInfo.nTreeSelector4;
    
    // Calculate how many groups of two plonk constraints can be made 
    const CPlonkConstraints = calculatePlonkConstraintsRowsFinalCompressor(plonkConstraints, customGatesInfo.nCustPoseidon12 + customGatesInfo.nPoseidon12, (customGatesInfo.nPoseidon12 + customGatesInfo.nCustPoseidon12)*3, (customGatesInfo.nPoseidon12 + customGatesInfo.nCustPoseidon12)*2, nCMulRows + nTreeSelector4Rows);

    customGatesInfo.nPlonkRows = CPlonkConstraints;

    let NUsed = CPlonkConstraints + nCMulRows + nTotalPoseidon12Rows + nFFT4Rows + nEvPol4Rows + nTreeSelector4Rows;
    

    console.log(`Number of CMul: ${customGatesInfo.nCMul} -> Constraints: ${nCMulRows}`);
    console.log(`Number of Poseidon12: ${customGatesInfo.nPoseidon12} -> Constraints: ${nPoseidon12Rows}`);
    console.log(`Number of Poseidon12 custom: ${customGatesInfo.nCustPoseidon12} -> Constraints: ${nCustPoseidon12Rows}`)
    console.log(`Total Number of Poseidon:  ${customGatesInfo.nPoseidon12 + customGatesInfo.nCustPoseidon12} -> Constraints ${nTotalPoseidon12Rows}`);
    console.log(`Number of FFT4: ${customGatesInfo.nFFT4} -> Constraints: ${nFFT4Rows}`);
    console.log(`Number of EvPol4: ${customGatesInfo.nEvPol4} -> Constraints: ${nEvPol4Rows}`);
    console.log(`Number of TreeSelector4: ${customGatesInfo.nTreeSelector4} -> Constraints: ${nTreeSelector4Rows}`);

    return {plonkConstraints, plonkAdditions, customGatesInfo, NUsed};
}