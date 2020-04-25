class A {  
    constructor () {}
    method a()
    modifies this
    {
        myB := new B();
        myB.b();
        var myB : int;
        myB := 2;
    }
    var myB : B;
}

class B {
    constructor () {}
    method b() {}
}