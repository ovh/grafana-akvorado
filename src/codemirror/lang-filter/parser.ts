// This file was generated by lezer-generator. You probably shouldn't edit it.
import {LRParser} from "@lezer/lr"
export const parser = LRParser.deserialize({
  version: 14,
  states: "#xO]QPOOOhQQO'#CrO]QPO'#CoO]QPO'#CoOmQSO'#CoQOQPOOO{QWO,59^OOQO,59Z,59ZO!WQPO,59ZO]QPO,59ZOOQO'#Ce'#CeO!]QWO'#CeOOQO1G.x1G.xO!eQSO1G.uOOQO1G.u1G.uO!sQQO,59POOQO'#Ci'#CiO]QPO7+$aO!{QWO,59TOOQO1G.k1G.kOOQO<<G{<<G{OOQO1G.o1G.o",
  stateData: "#Z~ObOSPOSQOS~OSQOVPOdRO~OWUO~OTXOUXO`cXecX~OYYOZYO[ZO~Oe]O~OY`OZ`O~OTaOUaO`cieci~O^bO_cO~OYeOZeO~OSVZQZ~",
  goto: "!UgPPPPPPPPPhPPPkPPPPPnPP}R[UR_ZQTOQVQQWRQ^XRdaZSOQRXa",
  nodeNames: "⚠ LineComment BlockComment Filter Not And Or Column Operator Value String Literal ValueLParen ListOfValues ValueComma ValueRParen",
  maxTerm: 22,
  skippedNodes: [0,1,2],
  repeatNodeCount: 0,
  tokenData: "4|~RrX^#]pq#]qr$Qrs$iwx&axy(Syz(Z|}(b}!O(g!O!P)U!P!Q)m!Q![)U![!])U!^!_$Q!_!`$Q!`!a$Q!c!d+`!d!p-O!p!q/w!q!r2|!r!}-O#T#U+`#U#b-O#b#c/w#c#d2|#d#o-O#y#z#]$f$g#]#BY#BZ#]$IS$I_#]$I|$JO#]$JT$JU#]$KV$KW#]&FU&FV#]~#bYb~X^#]pq#]#y#z#]$f$g#]#BY#BZ#]$IS$I_#]$I|$JO#]$JT$JU#]$KV$KW#]&FU&FV#]Q$VUWQqr$Q!^!_$Q!_!`$Q!`!a$Q!c!}$Q#T#o$Q~$nWY~OY$iZr$irs%Ws#O$i#O#P%]#P;'S$i;'S;=`&Z<%lO$i~%]OY~~%`RO;'S$i;'S;=`%i;=`O$i~%nXY~OY$iZr$irs%Ws#O$i#O#P%]#P;'S$i;'S;=`&Z;=`<%l$i<%lO$i~&^P;=`<%l$i~&fWY~OY&aZw&awx%Wx#O&a#O#P'O#P;'S&a;'S;=`'|<%lO&a~'RRO;'S&a;'S;=`'[;=`O&a~'aXY~OY&aZw&awx%Wx#O&a#O#P'O#P;'S&a;'S;=`'|;=`<%l&a<%lO&a~(PP;=`<%l&aX(ZOdP[WV(bOeT_Q~(gO^~~(jP}!O(m~(rSP~OY(mZ;'S(m;'S;=`)O<%lO(m~)RP;=`<%l(mW)ZUZW!O!P)U!P!Q)U!Q![)U![!])U!c!})U#T#o)U~)rVZWz{*X!O!P)U!P!Q)U!Q![)U![!])U!c!})U#T#o)U~*[TOz*Xz{*k{;'S*X;'S;=`+Y<%lO*X~*nVOz*Xz{*k{!P*X!P!Q+T!Q;'S*X;'S;=`+Y<%lO*X~+YOQ~~+]P;=`<%l*X_+i^WQVPZWqr$Q!O!P)U!P!Q)U!Q![,e![!])U!^!_$Q!_!`$Q!`!a$Q!c!p-O!p!q-w!q!}-O#T#b-O#b#c-w#c#o-OX,lUVPZW!O!P)U!P!Q)U!Q![,e![!])U!c!},e#T#o,eZ-XYWQVPZWqr$Q!O!P)U!P!Q)U!Q![,e![!])U!^!_$Q!_!`$Q!`!a$Q!c!}-O#T#o-O_.Q^WQVPZWqr$Q!O!P)U!P!Q)U!Q![,e![!])U!^!_$Q!_!`$Q!`!a$Q!c!f-O!f!g.|!g!}-O#T#W-O#W#X.|#X#o-O_/XYTSWQVPZWqr$Q!O!P)U!P!Q)U!Q![,e![!])U!^!_$Q!_!`$Q!`!a$Q!c!}-O#T#o-OZ0Q^WQVPZWqr$Q!O!P)U!P!Q)U!Q![,e![!])U!^!_$Q!_!`$Q!`!a$Q!c!q-O!q!r0|!r!}-O#T#c-O#c#d0|#d#o-OZ1V^WQVPZWqr$Q!O!P)U!P!Q)U!Q![,e![!])U!^!_$Q!_!`$Q!`!a$Q!c!v-O!v!w2R!w!}-O#T#h-O#h#i2R#i#o-OZ2^YWQSPVPZWqr$Q!O!P)U!P!Q)U!Q![,e![!])U!^!_$Q!_!`$Q!`!a$Q!c!}-O#T#o-O_3V^WQVPZWqr$Q!O!P)U!P!Q)U!Q![,e![!])U!^!_$Q!_!`$Q!`!a$Q!c!t-O!t!u4R!u!}-O#T#f-O#f#g4R#g#o-O_4^YWQUSVPZWqr$Q!O!P)U!P!Q)U!Q![,e![!])U!^!_$Q!_!`$Q!`!a$Q!c!}-O#T#o-O",
  tokenizers: [0, 1, 2, 3],
  topRules: {"Filter":[0,3]},
  tokenPrec: 97
})