
module.exports.log2 = function log2( V )
{
    return( ( ( V & 0xFFFF0000 ) !== 0 ? ( V &= 0xFFFF0000, 16 ) : 0 ) | ( ( V & 0xFF00FF00 ) !== 0 ? ( V &= 0xFF00FF00, 8 ) : 0 ) | ( ( V & 0xF0F0F0F0 ) !== 0 ? ( V &= 0xF0F0F0F0, 4 ) : 0 ) | ( ( V & 0xCCCCCCCC ) !== 0 ? ( V &= 0xCCCCCCCC, 2 ) : 0 ) | ( ( V & 0xAAAAAAAA ) !== 0 ) );
}

module.exports.connect = function connect(p1, i1, p2, i2) {
    [p1[i1], p2[i2]] = [p2[i2], p1[i1]];
}

module.exports.getKs = function getKs(n) {
    const ks = [module.exports.GOLDILOCKS_K];
    for (let i=1; i<n; i++) {
        ks[i] = (ks[i-1] * ks[0]) % module.exports.GOLDILOCKS_P;
    }
    return ks;
}

module.exports.evalPol = function evalPol(F, p, x) {
    if (p.length == 0) return F.zero;
    let res = p[p.length-1];
    for (let i=p.length-2; i>=0; i--) {
        res = F.add(F.mul(res, x), p[i]);
    }
    return res;
}

module.exports.GOLDILOCKS_P = 0xFFFFFFFF00000001n;
module.exports.GOLDILOCKS_K = 12275445934081160404n;
module.exports.GOLDILOCKS_GEN = [
    1n,
    18446744069414584320n,
    281474976710656n,
    18446744069397807105n,
    17293822564807737345n,
    70368744161280n,
    549755813888n,
    17870292113338400769n,
    13797081185216407910n,
    1803076106186727246n,
    11353340290879379826n,
    455906449640507599n,
    17492915097719143606n,
    1532612707718625687n,
    16207902636198568418n,
    17776499369601055404n,
    6115771955107415310n,
    12380578893860276750n,
    9306717745644682924n,
    18146160046829613826n,
    3511170319078647661n,
    17654865857378133588n,
    5416168637041100469n,
    16905767614792059275n,
    9713644485405565297n,
    5456943929260765144n,
    17096174751763063430n,
    1213594585890690845n,
    6414415596519834757n,
    16116352524544190054n,
    9123114210336311365n,
    4614640910117430873n,
    1753635133440165772n
];