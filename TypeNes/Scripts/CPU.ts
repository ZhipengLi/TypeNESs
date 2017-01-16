/*
Copyright (C) 2017 Charlie Lee

TypeNESs has referred to Ben Firshman's JSNES
https://github.com/bfirsh/jsnes

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

module NES {
    export enum IRQType { IRQ_NORMAL = 0, IRQ_NMI = 1, IRQ_RESET = 2 };

    // https://en.wikibooks.org/wiki/6502_Assembly
    //
    enum ADDRESSING_MODE{
        ACCUMULATOR = 4,
        IMPLIED = 2,
        IMMEDIATE = 5,
        ABSOLUTE = 3,
        ABSOLUTE_INDIRECT = 12,
        ZERO_PAGE = 0,
        RELATIVE = 1,
        ABSOLUTE_INDEXED_WITH_X = 8,
        ABSOLUTE_INDEXED_WITH_Y = 9,
        ZERO_PAGE_INDEXED_WITH_X = 6,
        ZERO_PAGE_INDEXED_WITH_Y = 7,
        ZERO_PAGE_INDEXED_WITH_X_INDIRECT = 10,
        ZERO_PAGE_INDIRECT_INDEXED_WITH_Y = 11,
    };

    enum INSTRUCTIONS {
        ADC = 0,
        AND = 1,
        ASL = 2,

        BCC = 3,
        BCS = 4,
        BEQ = 5,
        BIT = 6,
        BMI = 7,
        BNE = 8,
        BPL = 9,
        BRK = 10,
        BVC = 11,
        BVS = 12,

        CLC = 13,
        CLD = 14,
        CLI = 15,
        CLV = 16,
        CMP = 17,
        CPX = 18,
        CPY = 19,

        DEC = 20,
        DEX = 21,
        DEY = 22,

        EOR = 23,

        INC = 24,
        INX = 25,
        INY = 26,

        JMP = 27,
        JSR = 28,

        LDA = 29,
        LDX = 30,
        LDY = 31,
        LSR = 32,

        NOP = 33,

        ORA = 34,

        PHA = 35,
        PHP = 36,
        PLA = 37,
        PLP = 38,

        ROL = 39,
        ROR = 40,
        RTI = 41,
        RTS = 42,

        SBC = 43,
        SEC = 44,
        SED = 45,
        SEI = 46,
        STA = 47,
        STX = 48,
        STY = 49,

        TAX = 50,
        TAY = 51,
        TSX = 52,
        TXA = 53,
        TXS = 54,
        TYA = 55,
    }

    class Mapper {
        public load(num: number): number {
            return 0;
        }
        public write(addr: number, val: number) {

        }
    }

    export class CPU {
        private machine: Machine;
        private REG_A: number;
        private REG_X: number;
        private REG_Y: number;
        private REG_PC: number;
        private REG_S: number;
        private REG_P: number;
        private FLAG_N: number;
        private FLAG_V: number;
        private FLAG_B: number;
        private FLAG_D: number;
        private FLAG_I: number;
        private FLAG_Z: number;
        private FLAG_C: number;
        public mem: number[] = new Array(0x10000);
        private INT_requested: boolean;
        private irqType: IRQType;
        private instructionsData: Array<number>;
        public haltCycles: number = 0;
        private counter: number = 0;
        public constructor(m: Machine) {
            this.machine = m;
            this.reset();
            this.instructionsData = CPU.calcInstructionData();
        }

        public step(): number {
            if (this.INT_requested) {
                this.INT_requested = false;
                switch (this.irqType) {
                    case IRQType.IRQ_NORMAL:
                        break;
                    case IRQType.IRQ_NMI:
                        this.handleNMI();
                        break;
                    case IRQType.IRQ_RESET:
                        this.handleReset();
                        break;
                }
            }
            var inst = this.read8(this.REG_PC);
            var opdata = this.instructionsData[inst];
            var opcode = opdata & 0xff;
            var addrMode = (opdata >> 8) & 0xff;
            var oplenth = (opdata >> 16) & 0xff;
            var opcycles = (opdata >> 24) & 0xff;

            var operandAddr: number = 0;
            var extraCycle: number = 0;

            switch (addrMode) {
                case ADDRESSING_MODE.ABSOLUTE:
                    operandAddr = this.read16(this.REG_PC + 1);
                    break;
                case ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X:
                    operandAddr = this.read16(this.REG_PC + 1);
                    extraCycle = this.crossPage(operandAddr, operandAddr + this.REG_X) ? 1 : 0;
                    operandAddr += this.REG_X;
                    break;
                case ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_Y:
                    operandAddr = this.read16(this.REG_PC + 1);
                    extraCycle = this.crossPage(operandAddr, operandAddr + this.REG_Y) ? 1 : 0;
                    operandAddr += this.REG_Y;
                    break;
                case ADDRESSING_MODE.ABSOLUTE_INDIRECT:
                    operandAddr = this.read16(this.read16(this.REG_PC + 1));
                    break;
                case ADDRESSING_MODE.ACCUMULATOR:
                    break;
                case ADDRESSING_MODE.IMMEDIATE:
                    operandAddr = this.REG_PC + 1;
                    break;
                case ADDRESSING_MODE.IMPLIED:
                    break;
                case ADDRESSING_MODE.RELATIVE:
                    var val = this.read8(this.REG_PC + 1);
                    operandAddr = val < 0x80 ? this.REG_PC + oplenth + val : this.REG_PC + oplenth + val - 256;
                    break;
                case ADDRESSING_MODE.ZERO_PAGE:
                    operandAddr = this.read8(this.REG_PC + 1);
                    break;
                case ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X:
                    operandAddr = this.read8(this.REG_PC + 1) + this.REG_X;
                    break;
                case ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X_INDIRECT:
                    operandAddr = this.read8(this.REG_PC + 1);
                    extraCycle = this.crossPage(operandAddr, operandAddr + this.REG_X) ? 1 : 0;
                    operandAddr = this.read16(operandAddr + this.REG_X);
                    break;
                case ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_Y:
                    operandAddr = this.read8(this.REG_PC + 1) + this.REG_Y;
                    break;
                case ADDRESSING_MODE.ZERO_PAGE_INDIRECT_INDEXED_WITH_Y:
                    operandAddr = this.read16(this.read8(this.REG_PC + 1));
                    extraCycle = this.crossPage(operandAddr, operandAddr + this.REG_Y) ? 1 : 0;
                    operandAddr += this.REG_Y;
                    break;
            }

            this.counter++;

            if (this.machine.debugger.isDebuggerEnabled(this.counter)) {
                this.machine.debugger.setBefore(this.counter, this.REG_PC, inst, this.REG_A,
                    this.REG_X,
                    this.REG_Y,
                    this.REG_S,
                    this.REG_P,
                    this.FLAG_N,
                    this.FLAG_V,
                    this.FLAG_B,
                    this.FLAG_D,
                    this.FLAG_I,
                    this.FLAG_Z,
                    this.FLAG_C);
            }

            // http://nesdev.com/6502.txt
            // http://www.6502.org/tutorials/6502opcodes.html
            switch (opcode) {
                case INSTRUCTIONS.ADC:
                    var operand = this.read8(operandAddr);
                    var temp = this.REG_A + operand + this.FLAG_C;

                    this.FLAG_N = (temp>>7)&1;
                    this.FLAG_Z = (temp&0xff) == 0 ? 1 : 0;
                    this.FLAG_C = temp > 0xff ? 1 : 0;
                    this.FLAG_V = (((this.REG_A ^ operand) & 0x80) == 0) && (((this.REG_A ^ temp) & 0x80) != 0) ? 1 : 0;
                    this.REG_A = temp & 0xff;
                    break;
                case INSTRUCTIONS.AND:
                    var operand = this.read8(operandAddr);
                    this.REG_A = this.REG_A & operand;

                    this.FLAG_N = (this.REG_A>>7) & 1;
                    this.FLAG_Z = this.REG_A == 0 ? 1 : 0;
                    break;
                case INSTRUCTIONS.ASL:
                    var operand = addrMode == ADDRESSING_MODE.ACCUMULATOR ? this.REG_A : this.read8(operandAddr);
                    var temp = this.REG_A << 1;
                    this.FLAG_N = (temp>>7) & 1;
                    this.FLAG_Z = (temp & 0xff) == 0 ? 1 : 0;
                    this.FLAG_C = (this.REG_A & 0x80) != 0 ? 1 : 0;
                    this.REG_A = temp & 0xff;
                    break;
                case INSTRUCTIONS.BCC:
                    if (this.FLAG_C == 0) {
                        extraCycle = this.crossPage(this.REG_PC, operandAddr) ? 2 : 1;
                        this.REG_PC = operandAddr;
                        oplenth = 0;
                    }
                    break;
                case INSTRUCTIONS.BCS:
                    if (this.FLAG_C != 0) {
                        extraCycle = this.crossPage(this.REG_PC, operandAddr) ? 2 : 1;
                        this.REG_PC = operandAddr;
                        oplenth = 0;
                    }
                    break;
                case INSTRUCTIONS.BEQ:
                    if (this.FLAG_Z != 0) {
                        extraCycle = this.crossPage(this.REG_PC, operandAddr) ? 2 : 1;
                        this.REG_PC = operandAddr;
                        oplenth = 0;
                    }
                    break;
                case INSTRUCTIONS.BIT:
                    var operand = this.read8(operandAddr);
                    this.FLAG_N = (operand >> 7) & 1;
                    this.FLAG_V = (operand >> 6) & 1;
                    this.FLAG_Z = (operand & this.REG_A) == 0 ? 1 : 0;
                    break;
                case INSTRUCTIONS.BMI:
                    if (this.FLAG_N != 0) {
                        extraCycle = this.crossPage(this.REG_PC, operandAddr) ? 2 : 1;
                        this.REG_PC = operandAddr;
                        oplenth = 0;
                    }
                    break;
                case INSTRUCTIONS.BNE:
                    if (this.FLAG_Z == 0) {
                        extraCycle = this.crossPage(this.REG_PC, operandAddr) ? 2 : 1;
                        this.REG_PC = operandAddr;
                        oplenth = 0;
                    }
                    break;
                case INSTRUCTIONS.BPL:
                    if (this.FLAG_N == 0) {
                        extraCycle = this.crossPage(this.REG_PC, operandAddr) ? 2 : 1;
                        this.REG_PC = operandAddr;
                        oplenth = 0;
                    }
                    break;
                case INSTRUCTIONS.BRK:
                    this.requestINT(IRQType.IRQ_NORMAL);
                    break;
                case INSTRUCTIONS.BVC:
                    if (this.FLAG_V == 0) {
                        extraCycle = this.crossPage(this.REG_PC, operandAddr) ? 2 : 1;
                        this.REG_PC = operandAddr;
                        oplenth = 0;
                    }
                    break;
                case INSTRUCTIONS.BVS:
                    if (this.FLAG_V != 0) {
                        extraCycle = this.crossPage(this.REG_PC, operandAddr) ? 2 : 1;
                        this.REG_PC = operandAddr;
                        oplenth = 0;
                    }
                    break;
                case INSTRUCTIONS.CLC:
                    this.FLAG_C = 0;
                    break;
                case INSTRUCTIONS.CLD:
                    this.FLAG_D = 0;
                    break;
                case INSTRUCTIONS.CLI:
                    this.FLAG_I = 0;
                    break;
                case INSTRUCTIONS.CLV:
                    this.FLAG_V = 0;
                    break;
                case INSTRUCTIONS.CMP:
                    var operand = this.read8(operandAddr);
                    var temp = this.REG_A - operand;
                    this.FLAG_N = (temp>>7) & 1;
                    this.FLAG_Z = (temp & 0xff) == 0 ? 1 : 0;
                    this.FLAG_C = temp >= 0 ? 1 : 0;
                    break;
                case INSTRUCTIONS.CPX:
                    var operand = this.read8(operandAddr);
                    var temp = this.REG_X - operand;
                    this.FLAG_N = (temp >> 7) & 1;
                    this.FLAG_Z = (temp & 0xff) == 0 ? 1 : 0;
                    this.FLAG_C = temp >= 0 ? 1 : 0;
                    break;
                case INSTRUCTIONS.CPY:
                    var operand = this.read8(operandAddr);
                    var temp = this.REG_Y - operand;
                    this.FLAG_N = (temp >> 7) & 1;
                    this.FLAG_Z = (temp & 0xff) == 0 ? 1 : 0;
                    this.FLAG_C = temp >= 0 ? 1 : 0;
                    break;
                case INSTRUCTIONS.DEC:
                    var operand = this.read8(operandAddr);
                    var temp = (operand - 1)&0xff;
                    this.FLAG_N = (temp>>7) & 1;
                    this.FLAG_Z = temp == 0 ? 1 : 0;
                    this.write8(operandAddr, temp);
                    break;
                case INSTRUCTIONS.DEX:
                    var temp = (this.REG_X - 1)&0xff;
                    this.FLAG_N = (temp >> 7) & 1;
                    this.FLAG_Z = temp == 0 ? 1 : 0;
                    this.REG_X = temp & 0xff;
                    break;
                case INSTRUCTIONS.DEY:
                    var temp = (this.REG_Y - 1)&0xff;
                    this.FLAG_N = (temp >> 7) & 1;
                    this.FLAG_Z = temp == 0 ? 1 : 0;
                    this.REG_Y = temp & 0xff;
                    break;
                case INSTRUCTIONS.EOR:
                    this.REG_A = (this.REG_A ^ this.read8(operandAddr))&0xff;
                    this.FLAG_N = (this.REG_A >> 7) & 1;
                    this.FLAG_Z = this.REG_A == 0 ? 1 : 0;
                    break;
                case INSTRUCTIONS.INC:
                    var operand = this.read8(operandAddr);
                    var temp = (operand + 1) & 0xff;
                    this.FLAG_N = (temp >> 7) & 1;
                    this.FLAG_Z = temp == 0 ? 1 : 0;
                    this.write8(operandAddr, temp);
                    break;
                case INSTRUCTIONS.INX:
                    var temp = (this.REG_X + 1) & 0xff;
                    this.FLAG_N = (temp >> 7) & 1;
                    this.FLAG_Z = temp == 0 ? 1 : 0;
                    this.REG_X = temp;
                    break;
                case INSTRUCTIONS.INY:
                    var temp = (this.REG_Y + 1) & 0xff;
                    this.FLAG_N = (temp >> 7) & 1;
                    this.FLAG_Z = temp == 0 ? 1 : 0;
                    this.REG_Y = temp;
                    break;
                case INSTRUCTIONS.JMP:
                    //this.REG_PC = this.read16(operandAddr);
                    //if (this.counter == 0x19d32) {
                    //    alert("hit!");
                    //}
                    this.REG_PC = operandAddr;
                    oplenth = 0;
                    break;
                case INSTRUCTIONS.JSR:
                    this.push(((this.REG_PC + 2) >> 8) & 0xff);
                    this.push((this.REG_PC + 2) & 0xff);
                    //this.REG_PC = this.read16(operandAddr);
                    this.REG_PC = operandAddr;
                    oplenth = 0;
                    break;
                case INSTRUCTIONS.LDA:
                    //if (this.counter == 0x8e71)
                    //    alert("LDA hit!");
                    this.REG_A = this.read8(operandAddr);
                    this.FLAG_N = (this.REG_A >> 7) & 1;
                    this.FLAG_Z = this.REG_A == 0 ? 1 : 0;
                    break;
                case INSTRUCTIONS.LDX:
                    this.REG_X = this.read8(operandAddr);
                    this.FLAG_N = (this.REG_X >> 7) & 1;
                    this.FLAG_Z = this.REG_X == 0 ? 1 : 0;
                    break;
                case INSTRUCTIONS.LDY:
                    this.REG_Y = this.read8(operandAddr);
                    this.FLAG_N = (this.REG_Y >> 7) & 1;
                    this.FLAG_Z = this.REG_Y == 0 ? 1 : 0;
                    break;
                case INSTRUCTIONS.LSR:
                    var temp = addrMode == ADDRESSING_MODE.ACCUMULATOR ? this.REG_A : this.read8(operandAddr);
                    this.FLAG_N = 0;
                    this.FLAG_C = temp & 1;
                    temp = temp >> 1;
                    this.FLAG_Z = temp == 0 ? 1 : 0;
                    if (addrMode == ADDRESSING_MODE.ACCUMULATOR) {
                        this.REG_A = temp;
                    } else {
                        this.write8(operandAddr, temp);
                    }
                    break;
                case INSTRUCTIONS.NOP:
                    break;
                case INSTRUCTIONS.ORA:
                    var operand = this.read8(operandAddr);
                    var temp = operand | this.REG_A;
                    this.FLAG_N = (temp >> 7) & 1;
                    this.FLAG_Z = temp == 0 ? 1 : 0;
                    this.REG_A = temp;
                    break;
                case INSTRUCTIONS.PHA:
                    this.push(this.REG_A);
                    break;
                case INSTRUCTIONS.PHP:
                    this.push(this.readPS());
                    break;
                case INSTRUCTIONS.PLA:
                    this.REG_A = this.pop();
                    this.FLAG_N = (this.REG_A >> 7) & 1;
                    this.FLAG_Z = this.REG_A == 0 ? 1 : 0;
                    break;
                case INSTRUCTIONS.PLP:
                    this.setPS(this.pop());
                    break;
                case INSTRUCTIONS.ROL:
                    var operand = addrMode == ADDRESSING_MODE.ACCUMULATOR ? this.REG_A : this.read8(operandAddr);
                    var temp = ((operand << 1)&0xff) | this.FLAG_C;

                    this.FLAG_N = (temp >> 7) & 1;
                    this.FLAG_C = (operand>>7) & 1;
                    this.FLAG_Z = temp == 0 ? 1 : 0;

                    if (addrMode == ADDRESSING_MODE.ACCUMULATOR) {
                        this.REG_A = temp;
                    } else {
                        this.write8(operandAddr, temp);
                    }
                    break;
                case INSTRUCTIONS.ROR:
                    var operand = addrMode == ADDRESSING_MODE.ACCUMULATOR ? this.REG_A : this.read8(operandAddr);
                    var temp = (operand >> 1) | (this.FLAG_C<<7);

                    this.FLAG_N = (temp >> 7) & 1;
                    this.FLAG_C = operand & 1;
                    this.FLAG_Z = temp == 0 ? 1 : 0;

                    if (addrMode == ADDRESSING_MODE.ACCUMULATOR) {
                        this.REG_A = temp;
                    } else {
                        this.write8(operandAddr, temp);
                    }
                    break;
                case INSTRUCTIONS.RTI:
                    this.setPS(this.pop());
                    this.REG_PC = this.pop();
                    this.REG_PC = this.REG_PC+(this.pop() << 8);
                    oplenth = 0;
                    break;
                case INSTRUCTIONS.RTS:
                    this.REG_PC = this.pop();
                    this.REG_PC = this.REG_PC + (this.pop() << 8);
                    this.REG_PC++;
                    oplenth = 0;
                    break;
                case INSTRUCTIONS.SBC:
                    var operand = this.read8(operandAddr);
                    var temp = this.REG_A - operand - (1 - this.FLAG_C);
                    this.FLAG_N = (temp >> 7) & 1;
                    this.FLAG_Z = (temp & 0xff) == 0 ? 1 : 0;
                    this.FLAG_C = temp < 0 ? 0 : 1;
                    this.FLAG_V = ((((this.REG_A & 0x80) ^ (operand & 0x80)) == 0) && ((this.REG_A & 0x80) != (temp & 0x80))) ? 1 : 0;

                    this.REG_A = temp & 0xff;
                    break;
                case INSTRUCTIONS.SEC:
                    this.FLAG_C = 1;
                    break;
                case INSTRUCTIONS.SED:
                    this.FLAG_D = 1;
                    break;
                case INSTRUCTIONS.SEI:
                    this.FLAG_I = 1;
                    break;
                case INSTRUCTIONS.STA:
                    this.write8(operandAddr, this.REG_A);
                    //this.REG_A = this.read8(operandAddr);
                    //this.REG_A = operand;
                    break;
                case INSTRUCTIONS.STX:
                    this.write8(operandAddr, this.REG_X);
                    //this.REG_X = this.read8(operandAddr);
                    break;
                case INSTRUCTIONS.STY:
                    this.write8(operandAddr, this.REG_Y);
                    //this.REG_Y = this.read8(operandAddr);
                    break;
                case INSTRUCTIONS.TAX:
                    this.REG_X = this.REG_A;
                    break;
                case INSTRUCTIONS.TAY:
                    this.REG_Y = this.REG_A;
                    break;
                case INSTRUCTIONS.TSX:
                    this.REG_X = this.REG_S;
                    break;
                case INSTRUCTIONS.TXA:
                    this.REG_A = this.REG_X;
                    break;
                case INSTRUCTIONS.TXS:
                    this.REG_S = this.REG_X;
                    break;
                case INSTRUCTIONS.TYA:
                    this.REG_A = this.REG_Y;
                    break;
                default:
                    alert("error! instruction not existed!");
                    if (this.machine.debugger.hasPrinted == false) {
                        this.machine.debugger.outputHistoryStatus();
                    }
                    return -1;
            }
            this.REG_PC += oplenth;
            var totalCycles = opcycles + extraCycle;
            if (this.machine.debugger.isDebuggerEnabled(this.counter)) {
                this.machine.debugger.setAfter(this.counter, this.REG_PC, inst, this.REG_A,
                    this.REG_X,
                    this.REG_Y,
                    this.REG_S,
                    this.REG_P,
                    this.FLAG_N,
                    this.FLAG_V,
                    this.FLAG_B,
                    this.FLAG_D,
                    this.FLAG_I,
                    this.FLAG_Z,
                    this.FLAG_C,
                    totalCycles);
            }
            return totalCycles;

        }

        public reset(): void {
            this.setPS(0);
            this.REG_A = 0;
            this.REG_P = 0;
            this.REG_PC = 0x8000;
            this.REG_S = 0x100;
            this.REG_X = 0;
            this.REG_Y = 0;
            //this.RAM = new Array(0x800);
            this.haltCycles = 0;
            for (var i = 0; i < 0x10000; i++) {
                this.mem[i] = 0;
            }

            for (var i: number = 0; i < 0x2000; i++) {
                this.mem[i] = 0xff;
            }

            for (var i: number = 0; i < 4; i++) {
                this.mem[i * 0x800 + 0x008] = 0xf7;
                this.mem[i * 0x800 + 0x009] = 0xef;
                this.mem[i * 0x800 + 0x00a] = 0xdf;
                this.mem[i * 0x800 + 0x00f] = 0xbf;
            }

            for (var i: number = 0x2001; i < this.mem.length; i++) {
                this.mem[i] = 0;
            }

        }

        private crossPage(addr1: number, addr2: number): boolean {
            return (addr1 & 0xff00) != (addr2 & 0xff00);
        }

        //http://emulation.wikia.com/wiki/NES_CPU
        private handleIRQ_NORMAL(): void{
            this.push((this.REG_PC >> 8) & 0xff);
            this.push(this.REG_PC & 0xff);
            this.push(this.readPS());
            this.REG_PC = this.read16(0xfffe);
            this.FLAG_I = 1;
        }

        private handleNMI(): void {
            if ((this.machine.mmap.load(0x2000) & 128) != 0) {
                this.push((this.REG_PC >> 8) & 0xff);
                this.push(this.REG_PC & 0xff);
                this.push(this.readPS());
                this.REG_PC = this.read16(0xfffa);
            }
        }

        private handleReset(): void {
            this.REG_S = (this.REG_S - 3 + 0x100) & 0xff;
            this.FLAG_I = 1;
            this.REG_PC = this.read16(0xfffc);
        }

        private push(val: number): void{
            this.mem[this.REG_S + 0x100] = (val & 0xff);
            this.REG_S = this.REG_S == 0 ? 0xff : this.REG_S - 1;
        }

        public requestINT(type: IRQType): void {
            if (this.INT_requested) {
                if (type == IRQType.IRQ_NORMAL) {
                    return;
                }
            }
            this.INT_requested = true;
            this.irqType = type;
        }

        private pop(): number {
            this.REG_S++;
            this.REG_S = (this.REG_S & 0xFF);
            return this.mem[this.REG_S + 0x100];
        }
        private read8(addr: number): number {
            if (addr < 0x2000) {
                return this.mem[addr & 0x7ff];
            } else {
                return this.machine.mmap.load(addr);
            }
        }

        private read16(addr: number): number {
            if (addr < 0x2000) {
                return this.mem[addr & 0x7ff] | (this.mem[(addr+1) & 0x7ff]<<8);
            } else {
                return this.machine.mmap.load(addr) | (this.machine.mmap.load(addr+1)<<8);
            }
        }

        private write8(addr: number, val: number): void {
            if (addr < 0x2000) {
                this.mem[addr & 0x7ff] = (val & 0xff);
            } else {
                this.machine.mmap.write(addr, val);
            }
        }

        private setPS(status: number) {
            this.FLAG_C = status & 1;
            this.FLAG_Z = (status >> 1) & 1;
            this.FLAG_I = (status >> 2) & 1;
            this.FLAG_D = (status >> 3) & 1;
            this.FLAG_B = (status >> 5) & 1;
            this.FLAG_V = (status >> 6) & 1;
            this.FLAG_N = (status >> 7) & 1;
        }

        private readPS(): number {
            return this.FLAG_C
                | (this.FLAG_Z << 1)
                | (this.FLAG_I << 2)
                | (this.FLAG_D << 3)
                | (this.FLAG_B << 5)
                | (this.FLAG_V << 6)
                | (this.FLAG_N << 7);
        }

        private static calcInstructionData(): Array<number> {
            var res = new Array<number>(256);
            for (var i: number = 0; i < 256; i++) {
                res[i] = 0xff;
            }

            // ADC:
            res[0x69] = (INSTRUCTIONS.ADC & 0xff) | ((ADDRESSING_MODE.IMMEDIATE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0x65] = (INSTRUCTIONS.ADC & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0x75] = (INSTRUCTIONS.ADC & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (4 << 24);
            res[0x6D] = (INSTRUCTIONS.ADC & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x7D] = (INSTRUCTIONS.ADC & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x79] = (INSTRUCTIONS.ADC & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_Y & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x61] = (INSTRUCTIONS.ADC & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X_INDIRECT & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0x71] = (INSTRUCTIONS.ADC & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDIRECT_INDEXED_WITH_Y & 0xff) << 8) | (2 << 16) | (5 << 24);

            // AND:
            res[0x29] = (INSTRUCTIONS.AND & 0xff) | ((ADDRESSING_MODE.IMMEDIATE & 0xff) << 8) | (2 << 16) | (2 << 24);
            res[0x25] = (INSTRUCTIONS.AND & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0x35] = (INSTRUCTIONS.AND & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (4 << 24);
            res[0x2d] = (INSTRUCTIONS.AND & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x3d] = (INSTRUCTIONS.AND & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x39] = (INSTRUCTIONS.AND & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_Y & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x21] = (INSTRUCTIONS.AND & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X_INDIRECT & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0x31] = (INSTRUCTIONS.AND & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDIRECT_INDEXED_WITH_Y & 0xff) << 8) | (2 << 16) | (3 << 24);

            // ASL:
            res[0x0A] = (INSTRUCTIONS.ASL & 0xff) | ((ADDRESSING_MODE.ACCUMULATOR & 0xff) << 8) | (1 << 16) | (2 << 24);
            res[0x06] = (INSTRUCTIONS.ASL & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (5 << 24);
            res[0x16] = (INSTRUCTIONS.ASL & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0x0E] = (INSTRUCTIONS.ASL & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (6 << 24);
            res[0x1E] = (INSTRUCTIONS.ASL & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (7 << 24);

            // BCC:
            res[0x90] = (INSTRUCTIONS.BCC & 0xff) | ((ADDRESSING_MODE.RELATIVE & 0xff) << 8) | (2 << 16) | (2 << 24);

            // BCS:
            res[0xB0] = (INSTRUCTIONS.BCS & 0xff) | ((ADDRESSING_MODE.RELATIVE & 0xff) << 8) | (2 << 16) | (2 << 24);

            // BEQ:
            res[0xF0] = (INSTRUCTIONS.BEQ & 0xff) | ((ADDRESSING_MODE.RELATIVE & 0xff) << 8) | (2 << 16) | (2 << 24);

            // BIT:
            res[0x24] = (INSTRUCTIONS.BIT & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0x2C] = (INSTRUCTIONS.BIT & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);


            // BMI:
            res[0x30] = (INSTRUCTIONS.BMI & 0xff) | ((ADDRESSING_MODE.RELATIVE & 0xff) << 8) | (2 << 16) | (2 << 24);

            // BNE:
            res[0xD0] = (INSTRUCTIONS.BNE & 0xff) | ((ADDRESSING_MODE.RELATIVE & 0xff) << 8) | (2 << 16) | (2 << 24);

            // BPL:
            res[0x10] = (INSTRUCTIONS.BPL & 0xff) | ((ADDRESSING_MODE.RELATIVE & 0xff) << 8) | (2 << 16) | (2 << 24);

            // BRK:
            res[0x00] = (INSTRUCTIONS.BRK & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (7 << 24);

            // BVC:
            res[0x50] = (INSTRUCTIONS.BVC & 0xff) | ((ADDRESSING_MODE.RELATIVE & 0xff) << 8) | (2 << 16) | (2 << 24);

            // BVS:
            res[0x70] = (INSTRUCTIONS.BVS & 0xff) | ((ADDRESSING_MODE.RELATIVE & 0xff) << 8) | (2 << 16) | (2 << 24);


            // CLC:
            res[0x18] = (INSTRUCTIONS.CLC & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // CLD:
            res[0xD8] = (INSTRUCTIONS.CLD & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // CLI:
            res[0x58] = (INSTRUCTIONS.CLI & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // CLV:
            res[0xB8] = (INSTRUCTIONS.CLV & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // CMP:
            res[0xC9] = (INSTRUCTIONS.CMP & 0xff) | ((ADDRESSING_MODE.IMMEDIATE & 0xff) << 8) | (2 << 16) | (2 << 24);
            res[0xC5] = (INSTRUCTIONS.CMP & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0xD5] = (INSTRUCTIONS.CMP & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (4 << 24);
            res[0xCD] = (INSTRUCTIONS.CMP & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0xDD] = (INSTRUCTIONS.CMP & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0xD9] = (INSTRUCTIONS.CMP & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_Y & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0xC1] = (INSTRUCTIONS.CMP & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X_INDIRECT & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0xD1] = (INSTRUCTIONS.CMP & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDIRECT_INDEXED_WITH_Y & 0xff) << 8) | (2 << 16) | (5 << 24);

            // CPX:
            res[0xE0] = (INSTRUCTIONS.CPX & 0xff) | ((ADDRESSING_MODE.IMMEDIATE & 0xff) << 8) | (2 << 16) | (2 << 24);
            res[0xE4] = (INSTRUCTIONS.CPX & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0xEC] = (INSTRUCTIONS.CPX & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);

            // CPY:
            res[0xC0] = (INSTRUCTIONS.CPY & 0xff) | ((ADDRESSING_MODE.IMMEDIATE & 0xff) << 8) | (2 << 16) | (2 << 24);
            res[0xC4] = (INSTRUCTIONS.CPY & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0xCC] = (INSTRUCTIONS.CPY & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);


            // DEC:
            res[0xC6] = (INSTRUCTIONS.DEC & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (5 << 24);
            res[0xD6] = (INSTRUCTIONS.DEC & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0xCE] = (INSTRUCTIONS.DEC & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (6 << 24);
            res[0xDE] = (INSTRUCTIONS.DEC & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (7 << 24);

            // DEX:
            res[0xCA] = (INSTRUCTIONS.DEX & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // DEY:
            res[0x88] = (INSTRUCTIONS.DEY & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // EOR:
            res[0x49] = (INSTRUCTIONS.EOR & 0xff) | ((ADDRESSING_MODE.IMMEDIATE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0x45] = (INSTRUCTIONS.EOR & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0x55] = (INSTRUCTIONS.EOR & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (4 << 24);
            res[0x4D] = (INSTRUCTIONS.EOR & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x5D] = (INSTRUCTIONS.EOR & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x59] = (INSTRUCTIONS.EOR & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_Y & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x41] = (INSTRUCTIONS.EOR & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X_INDIRECT & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0x51] = (INSTRUCTIONS.EOR & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDIRECT_INDEXED_WITH_Y & 0xff) << 8) | (2 << 16) | (5 << 24);

            // INC:
            res[0xE6] = (INSTRUCTIONS.INC & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (5 << 24);
            res[0xF6] = (INSTRUCTIONS.INC & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0xEE] = (INSTRUCTIONS.INC & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (6 << 24);
            res[0xFE] = (INSTRUCTIONS.INC & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (7 << 24);

            // INX:
            res[0xE8] = (INSTRUCTIONS.INX & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // INY:
            res[0xC8] = (INSTRUCTIONS.INY & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // JMP:
            res[0x4C] = (INSTRUCTIONS.JMP & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (3 << 24);
            res[0x6C] = (INSTRUCTIONS.JMP & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDIRECT & 0xff) << 8) | (3 << 16) | (5 << 24);

            // JSR:
            res[0x20] = (INSTRUCTIONS.JSR & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (6 << 24);

            // LDA:
            res[0xA9] = (INSTRUCTIONS.LDA & 0xff) | ((ADDRESSING_MODE.IMMEDIATE & 0xff) << 8) | (2 << 16) | (2 << 24);
            res[0xA5] = (INSTRUCTIONS.LDA & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0xB5] = (INSTRUCTIONS.LDA & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (4 << 24);
            res[0xAD] = (INSTRUCTIONS.LDA & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0xBD] = (INSTRUCTIONS.LDA & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0xB9] = (INSTRUCTIONS.LDA & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_Y & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0xA1] = (INSTRUCTIONS.LDA & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X_INDIRECT & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0xB1] = (INSTRUCTIONS.LDA & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDIRECT_INDEXED_WITH_Y & 0xff) << 8) | (2 << 16) | (5 << 24);

            // LDX:
            res[0xA2] = (INSTRUCTIONS.LDX & 0xff) | ((ADDRESSING_MODE.IMMEDIATE & 0xff) << 8) | (2 << 16) | (2 << 24);
            res[0xA6] = (INSTRUCTIONS.LDX & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0xB6] = (INSTRUCTIONS.LDX & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_Y & 0xff) << 8) | (2 << 16) | (4 << 24);
            res[0xAE] = (INSTRUCTIONS.LDX & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0xBE] = (INSTRUCTIONS.LDX & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_Y & 0xff) << 8) | (3 << 16) | (4 << 24);

            // LDY:
            res[0xA0] = (INSTRUCTIONS.LDY & 0xff) | ((ADDRESSING_MODE.IMMEDIATE & 0xff) << 8) | (2 << 16) | (2 << 24);
            res[0xA4] = (INSTRUCTIONS.LDY & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0xB4] = (INSTRUCTIONS.LDY & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (4 << 24);
            res[0xAC] = (INSTRUCTIONS.LDY & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0xBC] = (INSTRUCTIONS.LDY & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (4 << 24);

            // LSR:
            res[0x4A] = (INSTRUCTIONS.LSR & 0xff) | ((ADDRESSING_MODE.ACCUMULATOR & 0xff) << 8) | (1 << 16) | (2 << 24);
            res[0x46] = (INSTRUCTIONS.LSR & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (5 << 24);
            res[0x56] = (INSTRUCTIONS.LSR & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0x4E] = (INSTRUCTIONS.LSR & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (6 << 24);
            res[0x5E] = (INSTRUCTIONS.LSR & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (7 << 24);

            // NOP:
            res[0xEA] = (INSTRUCTIONS.NOP & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // ORA:
            res[0x09] = (INSTRUCTIONS.ORA & 0xff) | ((ADDRESSING_MODE.IMMEDIATE & 0xff) << 8) | (2 << 16) | (2 << 24);
            res[0x05] = (INSTRUCTIONS.ORA & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0x15] = (INSTRUCTIONS.ORA & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (4 << 24);
            res[0x0D] = (INSTRUCTIONS.ORA & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x1D] = (INSTRUCTIONS.ORA & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x19] = (INSTRUCTIONS.ORA & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_Y & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x01] = (INSTRUCTIONS.ORA & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X_INDIRECT & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0x11] = (INSTRUCTIONS.ORA & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDIRECT_INDEXED_WITH_Y & 0xff) << 8) | (2 << 16) | (5 << 24);

            // PHA:
            res[0x48] = (INSTRUCTIONS.PHA & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (3 << 24);

            // PHP:
            res[0x08] = (INSTRUCTIONS.PHP & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (3 << 24);

            // PLA:
            res[0x68] = (INSTRUCTIONS.PLA & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (4 << 24);

            // PLP:
            res[0x28] = (INSTRUCTIONS.PLP & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (4 << 24);

            // ROL:
            res[0x2A] = (INSTRUCTIONS.ROL & 0xff) | ((ADDRESSING_MODE.ACCUMULATOR & 0xff) << 8) | (1 << 16) | (2 << 24);
            res[0x26] = (INSTRUCTIONS.ROL & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (5 << 24);
            res[0x36] = (INSTRUCTIONS.ROL & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0x2E] = (INSTRUCTIONS.ROL & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (6 << 24);
            res[0x3E] = (INSTRUCTIONS.ROL & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (7 << 24);

            // ROR:
            res[0x6A] = (INSTRUCTIONS.ROR & 0xff) | ((ADDRESSING_MODE.ACCUMULATOR & 0xff) << 8) | (1 << 16) | (2 << 24);
            res[0x66] = (INSTRUCTIONS.ROR & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (5 << 24);
            res[0x76] = (INSTRUCTIONS.ROR & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0x6E] = (INSTRUCTIONS.ROR & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (6 << 24);
            res[0x7E] = (INSTRUCTIONS.ROR & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (7 << 24);

            // RTI:
            res[0x40] = (INSTRUCTIONS.RTI & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (6 << 24);

            // RTS:
            res[0x60] = (INSTRUCTIONS.RTS & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (6 << 24);

            // SBC:
            res[0xE9] = (INSTRUCTIONS.SBC & 0xff) | ((ADDRESSING_MODE.IMMEDIATE & 0xff) << 8) | (2 << 16) | (2 << 24);
            res[0xE5] = (INSTRUCTIONS.SBC & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0xF5] = (INSTRUCTIONS.SBC & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (4 << 24);
            res[0xED] = (INSTRUCTIONS.SBC & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0xFD] = (INSTRUCTIONS.SBC & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0xF9] = (INSTRUCTIONS.SBC & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_Y & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0xE1] = (INSTRUCTIONS.SBC & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X_INDIRECT & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0xF1] = (INSTRUCTIONS.SBC & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDIRECT_INDEXED_WITH_Y & 0xff) << 8) | (2 << 16) | (5 << 24);

            // SEC:
            res[0x38] = (INSTRUCTIONS.SEC & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // SED:
            res[0xF8] = (INSTRUCTIONS.SED & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // SEI:
            res[0x78] = (INSTRUCTIONS.SEI & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // STA:
            res[0x85] = (INSTRUCTIONS.STA & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0x95] = (INSTRUCTIONS.STA & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (4 << 24);
            res[0x8D] = (INSTRUCTIONS.STA & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);
            res[0x9D] = (INSTRUCTIONS.STA & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_X & 0xff) << 8) | (3 << 16) | (5 << 24);
            res[0x99] = (INSTRUCTIONS.STA & 0xff) | ((ADDRESSING_MODE.ABSOLUTE_INDEXED_WITH_Y & 0xff) << 8) | (3 << 16) | (5 << 24);
            res[0x81] = (INSTRUCTIONS.STA & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X_INDIRECT & 0xff) << 8) | (2 << 16) | (6 << 24);
            res[0x91] = (INSTRUCTIONS.STA & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDIRECT_INDEXED_WITH_Y & 0xff) << 8) | (2 << 16) | (6 << 24);

            // STX:
            res[0x86] = (INSTRUCTIONS.STX & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0x96] = (INSTRUCTIONS.STX & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_Y & 0xff) << 8) | (2 << 16) | (4 << 24);
            res[0x8E] = (INSTRUCTIONS.STX & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);

            // STY:
            res[0x84] = (INSTRUCTIONS.STY & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE & 0xff) << 8) | (2 << 16) | (3 << 24);
            res[0x94] = (INSTRUCTIONS.STY & 0xff) | ((ADDRESSING_MODE.ZERO_PAGE_INDEXED_WITH_X & 0xff) << 8) | (2 << 16) | (4 << 24);
            res[0x8C] = (INSTRUCTIONS.STY & 0xff) | ((ADDRESSING_MODE.ABSOLUTE & 0xff) << 8) | (3 << 16) | (4 << 24);

            // TAX:
            res[0xAA] = (INSTRUCTIONS.TAX & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // TAY:
            res[0xA8] = (INSTRUCTIONS.TAY & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // TSX:
            res[0xBA] = (INSTRUCTIONS.TSX & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // TXA:
            res[0x8A] = (INSTRUCTIONS.TXA & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // TXS:
            res[0x9A] = (INSTRUCTIONS.TXS & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            // TYA:
            res[0x98] = (INSTRUCTIONS.TYA & 0xff) | ((ADDRESSING_MODE.IMPLIED & 0xff) << 8) | (1 << 16) | (2 << 24);

            return res;
        }
    }
}