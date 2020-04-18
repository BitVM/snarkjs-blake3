#!/usr/bin/env node

/*
    Copyright 2018 0KIMS association.

    This file is part of jaz (Zero Knowledge Circuit Compiler).

    jaz is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    jaz is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with jaz. If not, see <https://www.gnu.org/licenses/>.
*/

/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const zkSnark = require("./index.js");
const {stringifyBigInts, unstringifyBigInts} = require("ffjavascript").utils;

const loadR1cs = require("r1csfile").load;
const WitnessCalculatorBuilder = require("circom_runtime").WitnessCalculatorBuilder;

const version = require("./package").version;

const loadSyms = require("./src/loadsyms");
const printR1cs = require("./src/printr1cs");

const argv = require("yargs")
    .version(version)
    .usage(`snarkjs <command> <options>

setup command
=============

    snarkjs setup <option>

    Runs a setup for a circuit generating the proving and the verification key.

    -r or --r1cs <r1csFile>

        Filename of the compiled circuit file generated by circom.

        Default: circuit.r1cs

    --pk or --provingkey <provingKeyFile>

        Output filename where the proving key will be stored.

        Default: proving_key.json

    --vk or --verificationkey <verificationKeyFile>

        Output filename where the verification key will be stored.

        Default: verification_key.json

    --protocol [original|groth|kimleeoh]

        Defines which variant of the zk-SNARK protocol you want to use.

        Default: groth

    --verbose

        Print verbose to screen

calculate witness command
=========================

    snarkjs calculatewitness <options>

    Calculate the witness of a circuit given an input.

    --ws --wasm <wasmFile>

        Filename of the compiled circuit file generated by circom.

        Default: circuit.r1cs

    -i or --input <inputFile>

        JSON file with the inputs of the circuit.

        Default: input.json

        Example of a circuit with two inputs a and b:

            {"a": "22", "b": "33"}

    --wt --witness

        Output filename with the generated witness.

        Default: witness.json

    --lg or --logget

        Output GET access to the signals.

    --ls or --logset

        Output SET access to the signal.

    --lt or --logtrigger

        Output when a subcomponent is triggered and when finished.

    --s or --sanitycheck

     -s or --sym <symFile>

        Filename of the debuging symbols file generated by circom.

        Default: circuit.sym

generate a proof command
========================

    snarkjs proof <options>

    --wt or --witness

        Input filename used to calculate the proof.

        Default: witness.json

    --pk or --provingkey <provingKeyFile>

        Input filename with the proving key (generated during the setup).

        Default: proving_key.json

    -p or --proof

        Output filename with the zero-knowledge proof.

        Default: proof.json

    --pub or --public <publicFilename>

        Output filename with the value of the public wires/signals.
        This info will be needed to verify the proof.

        Default: public.json

    --verbose

        Print verbose to screen

verify command
==============

    snarkjs verify <options>

    The command returns "OK" if the proof is valid
    and  "INVALID" in case it is not a valid proof.

    --vk or --verificationkey <verificationKeyFile>

        Input filename with the verification key (generated during the setup).

        Default: verification_key.json

    -p or --proof

        Input filename with the zero-knowledge proof you want to verify.

        Default: proof.json

    --pub or --public <publicFilename>

        Input filename with the public wires/signals.

        Default: public.json


generate solidity verifier command
==================================

    snarkjs generateverifier <options>

    Generates a solidity smart contract that verifies the zero-knowledge proof.

    --vk or --verificationkey <verificationKeyFile>

        Input filename with the verification key (generated during the setup).

        Default: verification_key.json

    -v or --verifier

        Output file with a solidity smart contract that verifies a zero-knowledge proof.

        Default: verifier.sol


generate call parameters
========================

    snarkjs generatecall <options>

    Outputs into the console the raw parameters to be used in 'verifyProof'
    method of the solidity verifier function.

    -p or --proof

        Input filename with the zero-knowledge proof you want to use.

        Default: proof.json

    --pub or --public <publicFilename>

        Input filename with the public wires/signals.

        Default: public.json

circuit info
============

    snarkjs info <options>

    Print statistics of a circuit.

    -r or --r1cs <r1csFile>

        Filename of the compiled circuit file generated by circom.

        Default: circuit.r1cs

print constraints
=================

    snarkjs printconstraints <options>

    Print all the constraints of a given circuit.

    -r or --r1cs <r1csFile>

        Filename of the compiled circuit file generated by circom.

        Default: circuit.r1cs

    -s or --sym <symFile>

        Filename of the debuging symbols file generated by circom.

        Default: circuit.sym
        `)
    .alias("r", "r1cs")
    .alias("s", "sym")
    .alias("pk", "provingkey")
    .alias("vk", "verificationkey")
    .alias("wt", "witness")
    .alias("ws", "wasm")
    .alias("p", "proof")
    .alias("i", "input")
    .alias("pub", "public")
    .alias("v", "verifier")
    .alias("lo", "logoutput")
    .alias("lg", "logget")
    .alias("ls", "logset")
    .alias("lt", "logtrigger")
    .help("h")
    .alias("h", "help")

    .epilogue(`Copyright (C) 2018  0kims association
    This program comes with ABSOLUTELY NO WARRANTY;
    This is free software, and you are welcome to redistribute it
    under certain conditions; see the COPYING file in the official
    repo directory at  https://github.com/iden3/circom `)
    .argv;

const r1csName = (argv.r1cs) ? argv.r1cs : "circuit.r1cs";
const symName = (argv.sym) ? argv.sym : "circuit.sym";
const provingKeyName = (argv.provingkey) ? argv.provingkey : "proving_key.json";
const verificationKeyName = (argv.verificationkey) ? argv.verificationkey : "verification_key.json";
const inputName = (argv.input) ? argv.input : "input.json";
const wasmName = (argv.wasm) ? argv.wasm : "circuit.wasm";
const witnessName = (argv.witness) ? argv.witness : "witness.json";
const proofName = (argv.proof) ? argv.proof : "proof.json";
const publicName = (argv.public) ? argv.public : "public.json";
const verifierName = (argv.verifier) ? argv.verifier : "verifier.sol";
const protocol = (argv.protocol) ? argv.protocol : "groth";

run().then(() => {
    process.exit();
});

function p256(n) {
    let nstr = n.toString(16);
    while (nstr.length < 64) nstr = "0"+nstr;
    nstr = `"0x${nstr}"`;
    return nstr;
}

async function run() {
    try {
        if (argv._[0].toUpperCase() == "INFO") {
            const cir = await loadR1cs(r1csName);

            console.log(`# Wires: ${cir.nVars}`);
            console.log(`# Constraints: ${cir.nConstraints}`);
            console.log(`# Private Inputs: ${cir.nPrvInputs}`);
            console.log(`# Public Inputs: ${cir.nPubInputs}`);
            console.log(`# Outputs: ${cir.nOutputs}`);

        } else if (argv._[0].toUpperCase() == "PRINTCONSTRAINTS") {
            const cir = await loadR1cs(r1csName, true, true);

            const sym = await loadSyms(symName);

            printR1cs(cir, sym);
        } else if (argv._[0].toUpperCase() == "SETUP") {
            const cir = await loadR1cs(r1csName, true);

            if (!zkSnark[protocol]) throw new Error("Invalid protocol");
            const setup = zkSnark[protocol].setup(cir, argv.verbose);

            await fs.promises.writeFile(provingKeyName, JSON.stringify(stringifyBigInts(setup.vk_proof), null, 1), "utf-8");
            await fs.promises.writeFile(verificationKeyName, JSON.stringify(stringifyBigInts(setup.vk_verifier), null, 1), "utf-8");
        } else if (argv._[0].toUpperCase() == "CALCULATEWITNESS") {
            const wasm = await fs.promises.readFile(wasmName);
            const input = unstringifyBigInts(JSON.parse(await fs.promises.readFile(inputName, "utf8")));


            let options;
            let sym;
            if (argv.logset || argv.logget || argv.logtrigger || argv.sanitycheck) {
                options = {
                    sanityCheck: true
                };
                if (argv.logset) {
                    if (!sym) sym = await loadSyms(symName);
                    options.logSetSignal= function(labelIdx, value) {
                        console.log("SET " + sym.labelIdx2Name[labelIdx] + " <-- " + value.toString());
                    };
                }
                if (argv.logget) {
                    if (!sym) sym = await loadSyms(symName);
                    options.logGetSignal= function(varIdx, value) {
                        console.log("GET " + sym.labelIdx2Name[varIdx] + " --> " + value.toString());
                    };
                }
                if (argv.logtrigger) {
                    if (!sym) sym = await loadSyms(symName);
                    options.logStartComponent= function(cIdx) {
                        console.log("START: " + sym.componentIdx2Name[cIdx]);
                    };
                    options.logFinishComponent= function(cIdx) {
                        console.log("FINISH: " + sym.componentIdx2Name[cIdx]);
                    };
                }
            }

            const wc = await WitnessCalculatorBuilder(wasm, options);

            const w = await wc.calculateWitness(input);

            await fs.promises.writeFile(witnessName, JSON.stringify(stringifyBigInts(w), null, 1));

        } else if (argv._[0].toUpperCase() == "PROOF") {
            const witness = unstringifyBigInts(JSON.parse(fs.readFileSync(witnessName, "utf8")));
            const provingKey = unstringifyBigInts(JSON.parse(fs.readFileSync(provingKeyName, "utf8")));

            const protocol = provingKey.protocol;
            if (!zkSnark[protocol]) throw new Error("Invalid protocol");
            const {proof, publicSignals} = zkSnark[protocol].genProof(provingKey, witness, argv.verbose);

            await fs.promises.writeFile(proofName, JSON.stringify(stringifyBigInts(proof), null, 1), "utf-8");
            await fs.promises.writeFile(publicName, JSON.stringify(stringifyBigInts(publicSignals), null, 1), "utf-8");
        } else if (argv._[0].toUpperCase() == "VERIFY") {
            const public = unstringifyBigInts(JSON.parse(fs.readFileSync(publicName, "utf8")));
            const verificationKey = unstringifyBigInts(JSON.parse(fs.readFileSync(verificationKeyName, "utf8")));
            const proof = unstringifyBigInts(JSON.parse(fs.readFileSync(proofName, "utf8")));

            const protocol = verificationKey.protocol;
            if (!zkSnark[protocol]) throw new Error("Invalid protocol");

            const isValid = zkSnark[protocol].isValid(verificationKey, proof, public);

            if (isValid) {
                console.log("OK");
                process.exit(0);
            } else {
                console.log("INVALID");
                process.exit(1);
            }
        } else if (argv._[0].toUpperCase() == "GENERATEVERIFIER") {

            const verificationKey = unstringifyBigInts(JSON.parse(fs.readFileSync(verificationKeyName, "utf8")));

            let verifierCode;
            if (verificationKey.protocol == "original") {
                verifierCode = generateVerifier_original(verificationKey);
            } else if (verificationKey.protocol == "groth") {
                verifierCode = generateVerifier_groth(verificationKey);
            } else if (verificationKey.protocol == "kimleeoh") {
                verifierCode = generateVerifier_kimleeoh(verificationKey);
            } else {
                throw new Error("InvalidProof");
            }

            fs.writeFileSync(verifierName, verifierCode, "utf-8");
            process.exit(0);

        } else if (argv._[0].toUpperCase() == "GENERATECALL") {

            const public = unstringifyBigInts(JSON.parse(fs.readFileSync(publicName, "utf8")));
            const proof = unstringifyBigInts(JSON.parse(fs.readFileSync(proofName, "utf8")));

            let inputs = "";
            for (let i=0; i<public.length; i++) {
                if (inputs != "") inputs = inputs + ",";
                inputs = inputs + p256(public[i]);
            }

            let S;
            if ((typeof proof.protocol === "undefined") || (proof.protocol == "original")) {
                S=`[${p256(proof.pi_a[0])}, ${p256(proof.pi_a[1])}],` +
                  `[${p256(proof.pi_ap[0])}, ${p256(proof.pi_ap[1])}],` +
                  `[[${p256(proof.pi_b[0][1])}, ${p256(proof.pi_b[0][0])}],[${p256(proof.pi_b[1][1])}, ${p256(proof.pi_b[1][0])}]],` +
                  `[${p256(proof.pi_bp[0])}, ${p256(proof.pi_bp[1])}],` +
                  `[${p256(proof.pi_c[0])}, ${p256(proof.pi_c[1])}],` +
                  `[${p256(proof.pi_cp[0])}, ${p256(proof.pi_cp[1])}],` +
                  `[${p256(proof.pi_h[0])}, ${p256(proof.pi_h[1])}],` +
                  `[${p256(proof.pi_kp[0])}, ${p256(proof.pi_kp[1])}],` +
                  `[${inputs}]`;
            } else if ((proof.protocol == "groth")||(proof.protocol == "kimleeoh")) {
                S=`[${p256(proof.pi_a[0])}, ${p256(proof.pi_a[1])}],` +
                  `[[${p256(proof.pi_b[0][1])}, ${p256(proof.pi_b[0][0])}],[${p256(proof.pi_b[1][1])}, ${p256(proof.pi_b[1][0])}]],` +
                  `[${p256(proof.pi_c[0])}, ${p256(proof.pi_c[1])}],` +
                  `[${inputs}]`;
            } else {
                throw new Error("InvalidProof");
            }

            console.log(S);
            process.exit(0);
        } else {
            throw new Error("Invalid Command");
        }
    } catch(err) {
        console.log(err.stack);
        console.log("ERROR: " + err);
        process.exit(1);
    }
}


function generateVerifier_original(verificationKey) {
    let template = fs.readFileSync(path.join( __dirname,  "templates", "verifier_original.sol"), "utf-8");

    const vka_str = `[${verificationKey.vk_a[0][1].toString()},`+
                     `${verificationKey.vk_a[0][0].toString()}], `+
                    `[${verificationKey.vk_a[1][1].toString()},` +
                     `${verificationKey.vk_a[1][0].toString()}]`;
    template = template.replace("<%vk_a%>", vka_str);

    const vkb_str = `${verificationKey.vk_b[0].toString()},`+
                    `${verificationKey.vk_b[1].toString()}`;
    template = template.replace("<%vk_b%>", vkb_str);

    const vkc_str = `[${verificationKey.vk_c[0][1].toString()},`+
                     `${verificationKey.vk_c[0][0].toString()}], `+
                    `[${verificationKey.vk_c[1][1].toString()},` +
                     `${verificationKey.vk_c[1][0].toString()}]`;
    template = template.replace("<%vk_c%>", vkc_str);

    const vkg_str = `[${verificationKey.vk_g[0][1].toString()},`+
                      `${verificationKey.vk_g[0][0].toString()}], `+
                    `[${verificationKey.vk_g[1][1].toString()},` +
                     `${verificationKey.vk_g[1][0].toString()}]`;
    template = template.replace("<%vk_g%>", vkg_str);

    const vkgb1_str = `${verificationKey.vk_gb_1[0].toString()},`+
                      `${verificationKey.vk_gb_1[1].toString()}`;
    template = template.replace("<%vk_gb1%>", vkgb1_str);

    const vkgb2_str = `[${verificationKey.vk_gb_2[0][1].toString()},`+
                       `${verificationKey.vk_gb_2[0][0].toString()}], `+
                      `[${verificationKey.vk_gb_2[1][1].toString()},` +
                       `${verificationKey.vk_gb_2[1][0].toString()}]`;
    template = template.replace("<%vk_gb2%>", vkgb2_str);

    const vkz_str = `[${verificationKey.vk_z[0][1].toString()},`+
                     `${verificationKey.vk_z[0][0].toString()}], `+
                    `[${verificationKey.vk_z[1][1].toString()},` +
                     `${verificationKey.vk_z[1][0].toString()}]`;
    template = template.replace("<%vk_z%>", vkz_str);

    // The points

    template = template.replace("<%vk_input_length%>", (verificationKey.IC.length-1).toString());
    template = template.replace("<%vk_ic_length%>", verificationKey.IC.length.toString());
    let vi = "";
    for (let i=0; i<verificationKey.IC.length; i++) {
        if (vi != "") vi = vi + "        ";
        vi = vi + `vk.IC[${i}] = Pairing.G1Point(${verificationKey.IC[i][0].toString()},`+
                                                `${verificationKey.IC[i][1].toString()});\n`;
    }
    template = template.replace("<%vk_ic_pts%>", vi);

    return template;
}


function generateVerifier_groth(verificationKey) {
    let template = fs.readFileSync(path.join( __dirname,  "templates", "verifier_groth.sol"), "utf-8");


    const vkalfa1_str = `${verificationKey.vk_alfa_1[0].toString()},`+
                        `${verificationKey.vk_alfa_1[1].toString()}`;
    template = template.replace("<%vk_alfa1%>", vkalfa1_str);

    const vkbeta2_str = `[${verificationKey.vk_beta_2[0][1].toString()},`+
                         `${verificationKey.vk_beta_2[0][0].toString()}], `+
                        `[${verificationKey.vk_beta_2[1][1].toString()},` +
                         `${verificationKey.vk_beta_2[1][0].toString()}]`;
    template = template.replace("<%vk_beta2%>", vkbeta2_str);

    const vkgamma2_str = `[${verificationKey.vk_gamma_2[0][1].toString()},`+
                          `${verificationKey.vk_gamma_2[0][0].toString()}], `+
                         `[${verificationKey.vk_gamma_2[1][1].toString()},` +
                          `${verificationKey.vk_gamma_2[1][0].toString()}]`;
    template = template.replace("<%vk_gamma2%>", vkgamma2_str);

    const vkdelta2_str = `[${verificationKey.vk_delta_2[0][1].toString()},`+
                          `${verificationKey.vk_delta_2[0][0].toString()}], `+
                         `[${verificationKey.vk_delta_2[1][1].toString()},` +
                          `${verificationKey.vk_delta_2[1][0].toString()}]`;
    template = template.replace("<%vk_delta2%>", vkdelta2_str);

    // The points

    template = template.replace("<%vk_input_length%>", (verificationKey.IC.length-1).toString());
    template = template.replace("<%vk_ic_length%>", verificationKey.IC.length.toString());
    let vi = "";
    for (let i=0; i<verificationKey.IC.length; i++) {
        if (vi != "") vi = vi + "        ";
        vi = vi + `vk.IC[${i}] = Pairing.G1Point(${verificationKey.IC[i][0].toString()},`+
                                                `${verificationKey.IC[i][1].toString()});\n`;
    }
    template = template.replace("<%vk_ic_pts%>", vi);

    return template;
}

function generateVerifier_kimleeoh(verificationKey) {
    let template = fs.readFileSync(path.join( __dirname,  "templates", "verifier_groth.sol"), "utf-8");


    const vkalfa1_str = `${verificationKey.vk_alfa_1[0].toString()},`+
                        `${verificationKey.vk_alfa_1[1].toString()}`;
    template = template.replace("<%vk_alfa1%>", vkalfa1_str);

    const vkbeta2_str = `[${verificationKey.vk_beta_2[0][1].toString()},`+
                         `${verificationKey.vk_beta_2[0][0].toString()}], `+
                        `[${verificationKey.vk_beta_2[1][1].toString()},` +
                         `${verificationKey.vk_beta_2[1][0].toString()}]`;
    template = template.replace("<%vk_beta2%>", vkbeta2_str);

    const vkgamma2_str = `[${verificationKey.vk_gamma_2[0][1].toString()},`+
                          `${verificationKey.vk_gamma_2[0][0].toString()}], `+
                         `[${verificationKey.vk_gamma_2[1][1].toString()},` +
                          `${verificationKey.vk_gamma_2[1][0].toString()}]`;
    template = template.replace("<%vk_gamma2%>", vkgamma2_str);

    const vkdelta2_str = `[${verificationKey.vk_delta_2[0][1].toString()},`+
                          `${verificationKey.vk_delta_2[0][0].toString()}], `+
                         `[${verificationKey.vk_delta_2[1][1].toString()},` +
                          `${verificationKey.vk_delta_2[1][0].toString()}]`;
    template = template.replace("<%vk_delta2%>", vkdelta2_str);

    // The points

    template = template.replace("<%vk_input_length%>", (verificationKey.IC.length-1).toString());
    template = template.replace("<%vk_ic_length%>", verificationKey.IC.length.toString());
    let vi = "";
    for (let i=0; i<verificationKey.IC.length; i++) {
        if (vi != "") vi = vi + "        ";
        vi = vi + `vk.IC[${i}] = Pairing.G1Point(${verificationKey.IC[i][0].toString()},`+
                                                `${verificationKey.IC[i][1].toString()});\n`;
    }
    template = template.replace("<%vk_ic_pts%>", vi);

    return template;
}

