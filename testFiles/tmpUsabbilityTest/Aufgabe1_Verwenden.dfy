include "Aufgabe1_NichtVerwenden.dfy"
method Main() {
    var c := new Counter();
    c.number := 1; 

    //c.increase(c.number); 
    print(c.number); 
}