class Test {
    method AAAA() {
        
    }

    method BBBB() {
        this.AAAA();
    }
}

class Test2 {

    method AAAA() {
        var test1 := new Test;
        test1.BBBB();
    }

}
