
const {
    createBinFile,
    startWriteSection,
    endWriteSection,
} = require("@iden3/binfileutils");

async function writeStringToFile(fd, str) {
    let buff = new Uint8Array(str.length + 1);
    for (let i = 0; i < str.length; i++) {
        buff[i] = str.charCodeAt(i);
    }
    buff[str.length] = 0;

    await fd.write(buff);
}

module.exports.writeFixedPolsBin = async function writeFixedPolsBin(binFileName, airgroupName, airName, N, nFixedPols, fixedInfo) {
    const fixedColsBin = await createBinFile(binFileName, "cnst", 1, 1 << 25, 1 << 23);

    await startWriteSection(fixedColsBin, FIXED_POLS_SECTION);

    writeStringToFile(fixedColsBin, airgroupName);
    writeStringToFile(fixedColsBin, airName);
    await fixedColsBin.writeULE64(N);
    await fixedColsBin.writeULE32(nFixedPols);
    for(let i = 0; i < nFixedPols; ++i) {
        const def = fixedInfo[i];
        writeStringToFile(fixedColsBin, def.name);
        await fixedColsBin.writeULE32(def.lengths.length);
        for(let j = 0; j < def.lengths.length; ++j) {
            await fixedColsBin.writeULE32(def.lengths[j]);
        }
        const values = def.values;
        const buff = new BigUint64Array(values);
        await fixedColsBin.write(buff);
    }
    
    await endWriteSection(fixedColsBin);
}

