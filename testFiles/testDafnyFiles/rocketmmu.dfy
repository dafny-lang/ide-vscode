class RocketMMU
{

    var mem  : map<bv32, bv32>;
    var ptbr : bv32; 

    constructor init()
        modifies this;
    {
        ptbr := *;
        mem := map[];
    }

    function method vaddr2vpn(vaddr : bv32) : bv32 { (vaddr >> 12) }
    function method paddr2ppn(paddr : bv32) : bv32 { (paddr >> 12) }
    function method pte2ppn(pte : bv32) : bv32 { ((pte & 0x0007_ffff >> 10) & 0x1ff)  }
    function method vpn2ptaddr(vpn : bv32) : bv32 reads this { ptbr + (vpn) }

    method load_page_table(vaddr : bv32, paddr : bv32) 
        returns ()
        modifies this
        ensures (vpn2ptaddr(vaddr2vpn(vaddr)) in mem)
    {
        var vpn : bv32 := vaddr2vpn(vaddr);
        var ppn : bv32 := paddr2ppn(paddr);
        var ptindex : bv32 := vpn2ptaddr(vpn);
        var old_ptbr := ptbr;

        var pte : bv32;
        pte := (ppn << 10);
        write(ptindex, pte);
        assert ptbr == old_ptbr;
        assert ptindex == vpn2ptaddr(vaddr2vpn(vaddr));
        assert ptindex in mem;
        assert pte == paddr2ppn(paddr) << 10;
    }
    method write(paddr : bv32, data : bv32) 
        returns ()
        modifies this 
        ensures 
            (ptbr == old(ptbr))                 &&
            (paddr in mem)                      &&
            (mem[paddr] == data)                &&
            (mem == old(mem)[paddr := data])
    {
        mem := mem[paddr := data];
    }
}