# Can Butterscotch run Ichorous? No.

Evaluated 2026-11-15. Short answer: **Ichorous is a YYC build, Butterscotch
interprets bytecode, and there is no bytecode in this game.** Details below so
this does not have to be re-derived.

## What Butterscotch is

[Butterscotch](https://github.com/ButterscotchRunner/Butterscotch) is an open
source re-implementation of GameMaker: Studio's runner (the YoYo runner) in C.
It interprets the **bytecode** that GameMaker writes into `data.win`, and it
has a Web target along with desktop and console ones. It supports WAD
("bytecode") versions 8 through 17, i.e. GameMaker: Studio 1.0.198 through 2.2+.

From its own README, under *Game Compatibility*:

> Butterscotch's goal is to be able to have all bytecode compiled games
> playable.
>
> Of course, some games won't run! Some games aren't VM compiled, such as:
>
> - **Games compiled with YYC, because they use native code instead of
>   bytecode.** (Ex: Forager, Rivals of Aether)
> - Games compiled with the new GMRT, because they use native code instead of
>   bytecode.

That exclusion is the whole issue.

## Ichorous is YYC

Five independent checks, all from the files in
[`ichorousport/raw`](https://github.com/mightyhammerheadtree/ichorousport/tree/main/raw):

1. **`data.win` has no `CODE` chunk.** A full IFF walk (sizes are
   little-endian) lists GEN8, OPTN, LANG, EXTN, SOND, AGRP, SPRT, BGND, PATH,
   SCPT, GLOB, SHDR, FONT, TMLN, OBJT, FEDS, ACRV, SEQN, TAGS, ROOM, UILR,
   DAFL, EMBI, PSEM, PSYS, TPAG, TGIN, FEAT, STRG, TXTR, AUDO. No `CODE`, no
   `VARI`, no `FUNC`. Searching the entire 10 MB for the literal string `CODE`
   returns **zero** hits.
2. **`SCPT` code offsets are dummies.** It has 5313 entries, and their code
   offsets are `0x0`, `0x1`, `0x2`, … — sequential placeholders. The names are
   kept for reference; the bodies are not there. That is the YYC signature.
3. **`options.ini` names the YYC toolchain:**
   ```ini
   [Windows]
   SleepMargin=10
   [LLVM-WINDOWS]
   VisualStudioDir=C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat
   ```
   An `[LLVM-WINDOWS]` section pointing at Visual Studio is the YYC compiler
   configuration. A VM export has no such thing.
4. **The code is native in the executable.** `Ichorous.exe` is an x86-64 PE
   holding 5555 GML functions as machine code. This repo lifts and runs them:
   498 boot scripts execute with none throwing, 72 of 75 rooms enter, and 61
   draw something at 5.4 draw calls per frame. Bytecode is not involved
   anywhere in that pipeline.
5. **The port repo ships decompiled C.** `ichorousport` contains 5498
   `c_code/gml_GlobalScript_*.c` files against 5313 script entries — the
   product of decompiling a YYC binary. You only get that from native code.

## What would unblock it

A **VM (non-YYC) build** of the game. If the game can be exported from
GameMaker without YYC, that `data.win` would carry a `CODE` chunk with real
bytecode, and Butterscotch could load it — including targeting Web, which is
the interesting part since this project is a static site.

The `raw` folder contains only the YYC build, so nothing here can be fed to it
as-is.

## Alternatives

* **Keep lifting.** The current approach is what produces the 72/75 result
  above. It is the only route that works with the files available.
* **Compile the decompiled C.** `c_code/` has a C file per script. Wiring those
  to a GML runtime and compiling to wasm is theoretically a cleaner source than
  lifted machine code, but decompiler output is usually not directly
  compilable and would need as much runtime plumbing as the lifter already
  has.

## Reproducing the check

```sh
# data.win chunk list (little-endian sizes), and look for a CODE chunk
node -e 'const b=require("fs").readFileSync("data.win"),le=o=>b.readUInt32LE(o);
let p=8;while(p+8<=b.length){const t=b.slice(p,p+4).toString("latin1");
if(!/^[A-Z0-9]{4}$/.test(t))break;console.log(t,le(p+4));p+=8+le(p+4);}'
```

If a future `data.win` lists a `CODE` chunk with a non-trivial size, this
document is obsolete and Butterscotch becomes viable.
