

class MyClass {

    var field: int; 

    method  addOne(i: int) returns (r:int) {
       r := i + 1;
    }
    constructor () { }

}

    method  addOne(i: int) returns (r:int) {
        var field := 2;  
        r := i + 1;
    }

class OtherClass { 

    var field: int;  

    constructor () { }  
    method  addOne(i: int) returns (r:int) { 
       r := i + 51;
    }
    method hotStuff() modifies this { 
        var mc := new MyClass();   //macht hier n "new" symbol statt ctor.
        field := mc.addOne(2);   //symbol addone drin, weiss aber net wo er es finden kann. accessor ist wie weg.
        field := this.addOne(2);
        field := addOne(2);
    }

}

method Main() {
    var a:= new OtherClass();
    a.hotStuff();
    print a.field; 
}

