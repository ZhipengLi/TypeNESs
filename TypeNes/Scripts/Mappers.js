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
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var NES;
(function (NES) {
    var Mapper = (function () {
        function Mapper() {
        }
        Mapper.GetMapper = function (machine, num) {
            return new Mapper0(machine);
        };
        Mapper.copyArrayElements = function (src, srcPos, dest, destPos, length) {
            for (var i = 0; i < length; i++) {
                dest[destPos + i] = src[srcPos + i];
            }
        };
        return Mapper;
    })();
    NES.Mapper = Mapper;
    var Mapper0 = (function () {
        function Mapper0(nesMachine) {
            this.machine = nesMachine;
        }
        Mapper0.prototype.reset = function () {
            this.joystick1Counter = 0;
            this.joystick2Counter = 0;
            this.joypadLastWrite = 0;
            this.mousePressed = false;
            this.mouseX = null;
            this.mouseY = null;
        };
        Mapper0.prototype.write = function (address, value) {
            if (address < 0x2000) {
                // Mirroring of RAM:
                this.machine.cpu.mem[address & 0x7FF] = value;
            }
            else if (address > 0x4017) {
                this.machine.cpu.mem[address] = value;
                if (address >= 0x6000 && address < 0x8000) {
                }
            }
            else if (address > 0x2007 && address < 0x4000) {
                this.regWrite(0x2000 + (address & 0x7), value);
            }
            else {
                this.regWrite(address, value);
            }
        };
        Mapper0.prototype.writelow = function (address, value) {
            if (address < 0x2000) {
                // Mirroring of RAM:
                this.machine.cpu.mem[address & 0x7FF] = value;
            }
            else if (address > 0x4017) {
                this.machine.cpu.mem[address] = value;
            }
            else if (address > 0x2007 && address < 0x4000) {
                this.regWrite(0x2000 + (address & 0x7), value);
            }
            else {
                this.regWrite(address, value);
            }
        };
        Mapper0.prototype.load = function (address) {
            // Wrap around:
            address &= 0xFFFF;
            // Check address range:
            if (address > 0x4017) {
                // ROM:
                return this.machine.cpu.mem[address];
            }
            else if (address >= 0x2000) {
                // I/O Ports.
                return this.regLoad(address);
            }
            else {
                // RAM (mirrored)
                return this.machine.cpu.mem[address & 0x7FF];
            }
        };
        Mapper0.prototype.regLoad = function (address) {
            switch (address >> 12) {
                case 0:
                    break;
                case 1:
                    break;
                case 2:
                case 3:
                    // PPU Registers
                    switch (address & 0x7) {
                        case 0x0:
                            return this.machine.cpu.mem[0x2000];
                        case 0x1:
                            return this.machine.cpu.mem[0x2001];
                        case 0x2:
                            return this.machine.ppu.readPPUSTATUS$2002();
                        case 0x3:
                            return 0;
                        case 0x4:
                            return this.machine.ppu.readOAMADDR$2003();
                        case 0x5:
                            return 0;
                        case 0x6:
                            return 0;
                        case 0x7:
                            return this.machine.ppu.readPPUData$2007();
                    }
                    break;
                case 4:
                    switch (address - 0x4015) {
                        case 0:
                            // 0x4015:
                            return this.machine.papu.readReg(address);
                        case 1:
                            // 0x4016:
                            return this.readJoystick1();
                        case 2:
                            // 0x4017:
                            return this.readJoystick1();
                    }
                    break;
            }
            return 0;
        };
        Mapper0.prototype.regWrite = function (address, value) {
            switch (address) {
                case 0x2000:
                    // PPU Control register 1
                    this.machine.cpu.mem[address] = value;
                    this.machine.ppu.writePPUCTRL$2000(value);
                    break;
                case 0x2001:
                    // PPU Control register 2
                    this.machine.cpu.mem[address] = value;
                    this.machine.ppu.writePPUMASK$2001(value);
                    break;
                case 0x2003:
                    // Set Sprite RAM address:
                    this.machine.ppu.writeOAMADDR$2003(value);
                    break;
                case 0x2004:
                    // Write to Sprite RAM:
                    this.machine.ppu.writeOAMData$2004(value);
                    break;
                case 0x2005:
                    // Screen Scroll offsets:
                    this.machine.ppu.writePPUScroll$2005(value);
                    break;
                case 0x2006:
                    // Set VRAM address:
                    this.machine.ppu.writePPUADDR$2006(value);
                    break;
                case 0x2007:
                    // Write to VRAM:
                    this.machine.ppu.writePPUData$2007(value);
                    break;
                case 0x4014:
                    // Sprite Memory DMA Access
                    this.machine.ppu.writePPUData$4014(value);
                    break;
                case 0x4015:
                    // Sound Channel Switch, DMC Status
                    this.machine.papu.writeReg(address, value);
                    break;
                case 0x4016:
                    // Joystick 1 + Strobe
                    if (value === 0 && this.joypadLastWrite === 1) {
                        this.joystick1Counter = 0;
                        this.joystick2Counter = 0;
                    }
                    this.joypadLastWrite = value;
                    break;
                case 0x4017:
                    this.machine.papu.writeReg(address, value);
                    break;
                default:
                    // Sound registers
                    if (address >= 0x4000 && address <= 0x4017) {
                        this.machine.papu.writeReg(address, value);
                    }
            }
        };
        Mapper0.prototype.readJoystick1 = function () {
            var ret;
            switch (this.joystick1Counter) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                    ret = this.machine.keyboard.state1[this.joystick1Counter];
                    break;
                case 8:
                case 9:
                case 10:
                case 11:
                case 12:
                case 13:
                case 14:
                case 15:
                case 16:
                case 17:
                case 18:
                    ret = 0;
                    break;
                case 19:
                    ret = 1;
                    break;
                default:
                    ret = 0;
            }
            this.joystick1Counter++;
            if (this.joystick1Counter == 24) {
                this.joystick1Counter = 0;
            }
            return ret;
        };
        Mapper0.prototype.readJoystick2 = function () {
            var ret;
            switch (this.joystick2Counter) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                    ret = this.machine.keyboard.state2[this.joystick2Counter];
                    break;
                case 8:
                case 9:
                case 10:
                case 11:
                case 12:
                case 13:
                case 14:
                case 15:
                case 16:
                case 17:
                case 18:
                    ret = 0;
                    break;
                case 19:
                    ret = 1;
                    break;
                default:
                    ret = 0;
            }
            this.joystick2Counter++;
            if (this.joystick2Counter == 24) {
                this.joystick2Counter = 0;
            }
            return ret;
        };
        Mapper0.prototype.loadROM = function () {
            if (!this.machine.rom.valid || this.machine.rom.romCount < 1) {
                alert("NoMapper: Invalid ROM! Unable to load.");
                return;
            }
            // Load ROM into memory:
            this.loadPRGROM();
            // Load CHR-ROM:
            this.loadCHRROM();
            // Reset IRQ:
            this.machine.cpu.requestINT(NES.IRQType.IRQ_RESET);
        };
        Mapper0.prototype.loadPRGROM = function () {
            if (this.machine.rom.romCount > 1) {
                // Load the two first banks into memory.
                this.loadRomBank(0, 0x8000);
                this.loadRomBank(1, 0xC000);
            }
            else {
                // Load the one bank into both memory locations:
                this.loadRomBank(0, 0x8000);
                this.loadRomBank(0, 0xC000);
            }
        };
        Mapper0.prototype.loadCHRROM = function () {
            if (this.machine.rom.vromCount > 0) {
                if (this.machine.rom.vromCount == 1) {
                    this.loadVromBank(0, 0x0000);
                    this.loadVromBank(0, 0x1000);
                }
                else {
                    this.loadVromBank(0, 0x0000);
                    this.loadVromBank(1, 0x1000);
                }
            }
            else {
            }
        };
        Mapper0.prototype.loadRomBank = function (bank, address) {
            // Loads a ROM bank into the specified address.
            bank %= this.machine.rom.romCount;
            //var data = this.nes.rom.rom[bank];
            //cpuMem.write(address,data,data.length);
            Mapper.copyArrayElements(this.machine.rom.rom[bank], 0, this.machine.cpu.mem, address, 16384);
        };
        Mapper0.prototype.loadVromBank = function (bank, address) {
            if (this.machine.rom.vromCount === 0) {
                return;
            }
            Mapper.copyArrayElements(this.machine.rom.vrom[bank % this.machine.rom.vromCount], 0, this.machine.ppu.PPURAM, address, 4096);
            var vromTile = this.machine.rom.vromTile[bank % this.machine.rom.vromCount];
            Mapper.copyArrayElements(vromTile, 0, this.machine.ppu.tiles, address >> 4, 256);
        };
        Mapper0.prototype.load32kRomBank = function (bank, address) {
            this.loadRomBank((bank * 2) % this.machine.rom.romCount, address);
            this.loadRomBank((bank * 2 + 1) % this.machine.rom.romCount, address + 16384);
        };
        Mapper0.prototype.load8kVromBank = function (bank4kStart, address) {
            if (this.machine.rom.vromCount === 0) {
                return;
            }
            this.loadVromBank((bank4kStart) % this.machine.rom.vromCount, address);
            this.loadVromBank((bank4kStart + 1) % this.machine.rom.vromCount, address + 4096);
        };
        Mapper0.prototype.load1kVromBank = function (bank1k, address) {
            if (this.machine.rom.vromCount === 0) {
                return;
            }
            var bank4k = Math.floor(bank1k / 4) % this.machine.rom.vromCount;
            var bankoffset = (bank1k % 4) * 1024;
            Mapper.copyArrayElements(this.machine.rom.vrom[bank4k], 0, this.machine.ppu.PPURAM, bankoffset, 1024);
            // Update tiles:
            var vromTile = this.machine.rom.vromTile[bank4k];
            var baseIndex = address >> 4;
            for (var i = 0; i < 64; i++) {
                this.machine.ppu.tiles[baseIndex + i] = vromTile[((bank1k % 4) << 6) + i];
            }
        };
        Mapper0.prototype.load2kVromBank = function (bank2k, address) {
            if (this.machine.rom.vromCount === 0) {
                return;
            }
            var bank4k = Math.floor(bank2k / 2) % this.machine.rom.vromCount;
            var bankoffset = (bank2k % 2) * 2048;
            Mapper.copyArrayElements(this.machine.rom.vrom[bank4k], bankoffset, this.machine.ppu.PPURAM, address, 2048);
            // Update tiles:
            var vromTile = this.machine.rom.vromTile[bank4k];
            var baseIndex = address >> 4;
            for (var i = 0; i < 128; i++) {
                this.machine.ppu.tiles[baseIndex + i] = vromTile[((bank2k % 2) << 7) + i];
            }
        };
        Mapper0.prototype.load8kRomBank = function (bank8k, address) {
            var bank16k = Math.floor(bank8k / 2) % this.machine.rom.romCount;
            var offset = (bank8k % 2) * 8192;
            Mapper.copyArrayElements(this.machine.rom.rom[bank16k], offset, this.machine.cpu.mem, address, 8192);
        };
        Mapper0.prototype.clockIrqCounter = function () {
            // Does nothing. This is used by the MMC3 mapper.
        };
        Mapper0.prototype.latchAccess = function (address) {
            // Does nothing. This is used by MMC2.
        };
        return Mapper0;
    })();
    NES.Mapper0 = Mapper0;
    var Mapper1 = (function (_super) {
        __extends(Mapper1, _super);
        function Mapper1(nesMachine) {
            _super.call(this, nesMachine);
            this.reset();
        }
        Mapper1.prototype.reset = function () {
            this.joystick1Counter = 0;
            this.joystick2Counter = 0;
            this.joypadLastWrite = 0;
            this.mousePressed = false;
            this.mouseX = null;
            this.mouseY = null;
            this.regBuffer = 0;
            this.regBufferCounter = 0;
            // Register 0:
            this.mirroring = 0;
            this.oneScreenMirroring = 0;
            this.prgSwitchingArea = 1;
            this.prgSwitchingSize = 1;
            this.vromSwitchingSize = 0;
            // Register 1:
            this.romSelectionReg0 = 0;
            // Register 2:
            this.romSelectionReg1 = 0;
            // Register 3:
            this.romBankSelect = 0;
        };
        Mapper1.prototype.write = function (address, value) {
            if (address < 0x8000) {
                if (address < 0x2000) {
                    // Mirroring of RAM:
                    this.machine.cpu.mem[address & 0x7FF] = value;
                }
                else if (address > 0x4017 && address < 0x8000) {
                    this.machine.cpu.mem[address] = value;
                    if (address >= 0x6000 && address < 0x8000) {
                    }
                }
                else if (address > 0x2007 && address < 0x4000) {
                    this.regWrite(0x2000 + (address & 0x7), value);
                }
                else if (address < 0x8000) {
                    this.regWrite(address, value);
                }
            }
            else {
                if ((value & 128) !== 0) {
                    this.regBufferCounter = 0;
                    this.regBuffer = 0;
                    if (this.getRegNumber(address) == 0) {
                        this.prgSwitchingArea = 1;
                        this.prgSwitchingSize = 1;
                    }
                }
                else {
                    // Write one bit every time. The later the bit it, the higher it is.
                    this.regBuffer = (this.regBuffer & (0xFF - (1 << this.regBufferCounter))) | ((value & 1) << this.regBufferCounter);
                    this.regBufferCounter++;
                    if (this.regBufferCounter == 5) {
                        // Use the buffered value:
                        this.setReg(this.getRegNumber(address), this.regBuffer);
                        // Reset buffer:
                        this.regBuffer = 0;
                        this.regBufferCounter = 0;
                    }
                }
            }
        };
        Mapper1.prototype.setReg = function (reg, value) {
            var tmp;
            switch (reg) {
                case 0:
                    // Mirroring:
                    tmp = value & 3;
                    if (tmp !== this.mirroring) {
                        // Set mirroring:
                        this.mirroring = tmp;
                        if ((this.mirroring & 2) === 0) {
                            this.machine.ppu.setMirroringType(NES.MIRRORING_TYPE.SINGLESCREEN_MIRRORING);
                        }
                        else if ((this.mirroring & 1) !== 0) {
                            this.machine.ppu.setMirroringType(NES.MIRRORING_TYPE.HORIZONTAL_MIRRORING);
                        }
                        else {
                            this.machine.ppu.setMirroringType(NES.MIRRORING_TYPE.VERTICAL_MIRRORING);
                        }
                    }
                    // PRG Switching Area;
                    this.prgSwitchingArea = (value >> 2) & 1;
                    // PRG Switching Size:
                    this.prgSwitchingSize = (value >> 3) & 1;
                    // VROM Switching Size:
                    this.vromSwitchingSize = (value >> 4) & 1;
                    break;
                case 1:
                    // ROM selection:
                    this.romSelectionReg0 = (value >> 4) & 1;
                    // Check whether the cart has VROM:
                    if (this.machine.rom.vromCount > 0) {
                        // Select VROM bank at 0x0000:
                        if (this.vromSwitchingSize === 0) {
                            // Swap 8kB VROM:
                            if (this.romSelectionReg0 === 0) {
                                this.load8kVromBank((value & 0xF), 0x0000);
                            }
                            else {
                                this.load8kVromBank(Math.floor(this.machine.rom.vromCount / 2) +
                                    (value & 0xF), 0x0000);
                            }
                        }
                        else {
                            // Swap 4kB VROM:
                            if (this.romSelectionReg0 === 0) {
                                this.loadVromBank((value & 0xF), 0x0000);
                            }
                            else {
                                this.loadVromBank(Math.floor(this.machine.rom.vromCount / 2) +
                                    (value & 0xF), 0x0000);
                            }
                        }
                    }
                    break;
                case 2:
                    // ROM selection:
                    this.romSelectionReg1 = (value >> 4) & 1;
                    // Check whether the cart has VROM:
                    if (this.machine.rom.vromCount > 0) {
                        // Select VROM bank at 0x1000:
                        if (this.vromSwitchingSize === 1) {
                            // Swap 4kB of VROM:
                            if (this.romSelectionReg1 === 0) {
                                this.loadVromBank((value & 0xF), 0x1000);
                            }
                            else {
                                this.loadVromBank(Math.floor(this.machine.rom.vromCount / 2) +
                                    (value & 0xF), 0x1000);
                            }
                        }
                    }
                    break;
                default:
                    // Select ROM bank:
                    // -------------------------
                    tmp = value & 0xF;
                    var bank;
                    var baseBank = 0;
                    if (this.machine.rom.romCount >= 32) {
                        // 1024 kB cart
                        if (this.vromSwitchingSize === 0) {
                            if (this.romSelectionReg0 === 1) {
                                baseBank = 16;
                            }
                        }
                        else {
                            baseBank = (this.romSelectionReg0
                                | (this.romSelectionReg1 << 1)) << 3;
                        }
                    }
                    else if (this.machine.rom.romCount >= 16) {
                        // 512 kB cart
                        if (this.romSelectionReg0 === 1) {
                            baseBank = 8;
                        }
                    }
                    if (this.prgSwitchingSize === 0) {
                        // 32kB
                        bank = baseBank + (value & 0xF);
                        this.load32kRomBank(bank, 0x8000);
                    }
                    else {
                        // 16kB
                        bank = baseBank * 2 + (value & 0xF);
                        if (this.prgSwitchingArea === 0) {
                            this.loadRomBank(bank, 0xC000);
                        }
                        else {
                            this.loadRomBank(bank, 0x8000);
                        }
                    }
            }
        };
        ;
        // Returns the register number from the address written to:
        Mapper1.prototype.getRegNumber = function (address) {
            if (address >= 0x8000 && address <= 0x9FFF) {
                return 0;
            }
            else if (address >= 0xA000 && address <= 0xBFFF) {
                return 1;
            }
            else if (address >= 0xC000 && address <= 0xDFFF) {
                return 2;
            }
            else {
                return 3;
            }
        };
        ;
        Mapper1.prototype.loadROM = function () {
            if (!this.machine.rom.valid || this.machine.rom.romCount < 1) {
                alert("NoMapper: Invalid ROM! Unable to load.");
                return;
            }
            //// Load ROM into memory:
            this.loadRomBank(0, 0x8000); //   First ROM bank..
            this.loadRomBank(this.machine.rom.romCount - 1, 0xC000); // ..and last ROM bank.
            // Load CHR-ROM:
            this.loadCHRROM();
            // Reset IRQ:
            this.machine.cpu.requestINT(NES.IRQType.IRQ_RESET);
        };
        return Mapper1;
    })(Mapper0);
    NES.Mapper1 = Mapper1;
    var Mapper2 = (function (_super) {
        __extends(Mapper2, _super);
        function Mapper2() {
            _super.apply(this, arguments);
        }
        Mapper2.prototype.write = function (addr, val) {
            if (addr < 0x8000) {
                _super.prototype.write.call(this, addr, val);
            }
            else {
                this.loadRomBank(val, 0x8000);
            }
        };
        Mapper2.prototype.loadROM = function () {
            if (!this.machine.rom.valid || this.machine.rom.romCount < 1) {
                alert("NoMapper: Invalid ROM! Unable to load.");
                return;
            }
            //// Load ROM into memory:
            this.loadRomBank(0, 0x8000); //   First ROM bank..
            this.loadRomBank(this.machine.rom.romCount - 1, 0xC000); // ..and last ROM bank.
            // Load CHR-ROM:
            this.loadCHRROM();
            this.machine.cpu.requestINT(NES.IRQType.IRQ_RESET);
        };
        return Mapper2;
    })(Mapper0);
    NES.Mapper2 = Mapper2;
    var Mapper4 = (function (_super) {
        __extends(Mapper4, _super);
        function Mapper4(nes) {
            _super.call(this, nes);
            this.CMD_SEL_2_1K_VROM_0800 = 1;
            this.CMD_SEL_1K_VROM_1000 = 2;
            this.CMD_SEL_1K_VROM_1400 = 3;
            this.CMD_SEL_1K_VROM_1800 = 4;
            this.CMD_SEL_1K_VROM_1C00 = 5;
            this.CMD_SEL_ROM_PAGE1 = 6;
            this.CMD_SEL_ROM_PAGE2 = 7;
            this.command = null;
            this.prgAddressSelect = null;
            this.chrAddressSelect = null;
            this.pageNumber = null;
            this.irqCounter = null;
            this.irqLatchValue = null;
            this.irqEnable = null;
            this.prgAddressChanged = false;
        }
        Mapper4.prototype.write = function (addr, val) {
            if (addr < 0x8000) {
                _super.prototype.write.call(this, addr, val);
                return;
            }
            switch (addr) {
                case 0x8000:
                    // Command/Address Select register
                    this.command = val & 7;
                    var tmp = (val >> 6) & 1;
                    if (tmp != this.prgAddressSelect) {
                        this.prgAddressChanged = true;
                    }
                    this.prgAddressSelect = tmp;
                    this.chrAddressSelect = (val >> 7) & 1;
                    break;
                case 0x8001:
                    this.executeCommand(this.command, val);
                    break;
                case 0xA000:
                    if ((val & 1) !== 0) {
                        this.machine.ppu.setMirroringType(NES.MIRRORING_TYPE.HORIZONTAL_MIRRORING);
                    }
                    else {
                        this.machine.ppu.setMirroringType(NES.MIRRORING_TYPE.VERTICAL_MIRRORING);
                    }
                    break;
                case 0xA001:
                    break;
                case 0xC000:
                    // IRQ Counter register
                    this.irqCounter = val;
                    break;
                case 0xC001:
                    // IRQ Latch register
                    this.irqLatchValue = val;
                    break;
                case 0xE000:
                    this.irqEnable = 0;
                    break;
                case 0xE001:
                    // IRQ Control Reg 1 (enable)
                    this.irqEnable = 1;
                    break;
                default:
            }
        };
        Mapper4.prototype.executeCommand = function (cmd, arg) {
            switch (cmd) {
                case this.CMD_SEL_2_1K_VROM_0000:
                    if (this.chrAddressSelect === 0) {
                        this.load1kVromBank(arg, 0x0000);
                        this.load1kVromBank(arg + 1, 0x0400);
                    }
                    else {
                        this.load1kVromBank(arg, 0x1000);
                        this.load1kVromBank(arg + 1, 0x1400);
                    }
                    break;
                case this.CMD_SEL_2_1K_VROM_0800:
                    // Select 2 1KB VROM pages at 0x0800:
                    if (this.chrAddressSelect === 0) {
                        this.load1kVromBank(arg, 0x0800);
                        this.load1kVromBank(arg + 1, 0x0C00);
                    }
                    else {
                        this.load1kVromBank(arg, 0x1800);
                        this.load1kVromBank(arg + 1, 0x1C00);
                    }
                    break;
                case this.CMD_SEL_1K_VROM_1000:
                    if (this.chrAddressSelect === 0) {
                        this.load1kVromBank(arg, 0x1000);
                    }
                    else {
                        this.load1kVromBank(arg, 0x0000);
                    }
                    break;
                case this.CMD_SEL_1K_VROM_1400:
                    // Select 1K VROM Page at 0x1400:
                    if (this.chrAddressSelect === 0) {
                        this.load1kVromBank(arg, 0x1400);
                    }
                    else {
                        this.load1kVromBank(arg, 0x0400);
                    }
                    break;
                case this.CMD_SEL_1K_VROM_1800:
                    // Select 1K VROM Page at 0x1800:
                    if (this.chrAddressSelect === 0) {
                        this.load1kVromBank(arg, 0x1800);
                    }
                    else {
                        this.load1kVromBank(arg, 0x0800);
                    }
                    break;
                case this.CMD_SEL_1K_VROM_1C00:
                    // Select 1K VROM Page at 0x1C00:
                    if (this.chrAddressSelect === 0) {
                        this.load1kVromBank(arg, 0x1C00);
                    }
                    else {
                        this.load1kVromBank(arg, 0x0C00);
                    }
                    break;
                case this.CMD_SEL_ROM_PAGE1:
                    if (this.prgAddressChanged) {
                        // Load the two hardwired banks:
                        if (this.prgAddressSelect === 0) {
                            this.load8kRomBank(((this.machine.rom.romCount - 1) * 2), 0xC000);
                        }
                        else {
                            this.load8kRomBank(((this.machine.rom.romCount - 1) * 2), 0x8000);
                        }
                        this.prgAddressChanged = false;
                    }
                    // Select first switchable ROM page:
                    if (this.prgAddressSelect === 0) {
                        this.load8kRomBank(arg, 0x8000);
                    }
                    else {
                        this.load8kRomBank(arg, 0xC000);
                    }
                    break;
                case this.CMD_SEL_ROM_PAGE2:
                    // Select second switchable ROM page:
                    this.load8kRomBank(arg, 0xA000);
                    // hardwire appropriate bank:
                    if (this.prgAddressChanged) {
                        // Load the two hardwired banks:
                        if (this.prgAddressSelect === 0) {
                            this.load8kRomBank(((this.machine.rom.romCount - 1) * 2), 0xC000);
                        }
                        else {
                            this.load8kRomBank(((this.machine.rom.romCount - 1) * 2), 0x8000);
                        }
                        this.prgAddressChanged = false;
                    }
            }
        };
        Mapper4.prototype.loadROM = function () {
            if (!this.machine.rom.valid) {
                alert("MMC3: Invalid ROM! Unable to load.");
                return;
            }
            // Load hardwired PRG banks (0xC000 and 0xE000):
            this.load8kRomBank(((this.machine.rom.romCount - 1) * 2), 0xC000);
            this.load8kRomBank(((this.machine.rom.romCount - 1) * 2) + 1, 0xE000);
            // Load swappable PRG banks (0x8000 and 0xA000):
            this.load8kRomBank(0, 0x8000);
            this.load8kRomBank(1, 0xA000);
            // Load CHR-ROM:
            this.loadCHRROM();
            // Do Reset-Interrupt:
            this.machine.cpu.requestINT(NES.IRQType.IRQ_RESET);
        };
        Mapper4.prototype.clockIrqCounter = function () {
            if (this.irqEnable == 1) {
                this.irqCounter--;
                if (this.irqCounter < 0) {
                    // Trigger IRQ:
                    //nes.getCpu().doIrq();
                    this.machine.cpu.requestINT(NES.IRQType.IRQ_NORMAL);
                    this.irqCounter = this.irqLatchValue;
                }
            }
        };
        return Mapper4;
    })(Mapper0);
    NES.Mapper4 = Mapper4;
})(NES || (NES = {}));
//# sourceMappingURL=Mappers.js.map