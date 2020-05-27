include "Aufgabe1_NichtVerwenden.dfy"
method Main() {
    var c := new Counter();
    c.number := 1; 
    // todo: number um eins hochzählen 
    print(c.number); 
}