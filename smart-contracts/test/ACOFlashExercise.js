const { expect } = require("chai");
const factoryABI = require("../artifacts/ACOFactory.json");

describe("ACOFlashExercise", function() {
  let owner;
  let addr1;
  let addr2;
  let addr3;
  let fee = ethers.utils.bigNumberify("100");
  let token1;
  let token1Name = "TOKEN1";
  let token1Symbol = "TOK1";
  let token1Decimals = 8;
  let token1TotalSupply = ethers.utils.bigNumberify("10000000000000");
  let token2;
  let token2Name = "TOKEN2";
  let token2Symbol = "TOK2";
  let token2Decimals = 18;
  let token2TotalSupply = ethers.utils.bigNumberify("100000000000000000000000000");
  let buidlerFactory;
  let buidlerEthT1003C;
  let buidlerEthT1003P;
  let price1;
  let buidlerT1T210000P;
  let buidlerT1T210000C;
  let price2;
  let time;
  let flashExercise;
  let uniswapFactory;
  let weth;
  let uniswapRouter;
  let pairToken1Token2;
  let pairToken1weth;
  let maxExercisedAccounts = 120;
  let token1Liq = ethers.utils.bigNumberify("1000000000");
  let token2Liq = ethers.utils.bigNumberify("90000000000000000000000");
  let wethLiq = ethers.utils.bigNumberify("300000000000000000000");

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
    
    let ACOFactory = await (await ethers.getContractFactory("ACOFactory")).deploy();
    await ACOFactory.deployed();
    let ACOFactoryV2 = await (await ethers.getContractFactory("ACOFactoryV2")).deploy();
    await ACOFactoryV2.deployed();
    
    let factoryInterface = new ethers.utils.Interface(factoryABI.abi);

    let ACOToken = await (await ethers.getContractFactory("ACOToken")).deploy();
    await ACOToken.deployed();

    let ownerAddr = await owner.getAddress();
    let addr2Addr = await addr2.getAddress();
    let initData = factoryInterface.functions.init.encode([ownerAddr, ACOToken.address, fee, addr2Addr]);
    let buidlerProxy = await (await ethers.getContractFactory("ACOProxy")).deploy(ownerAddr, ACOFactory.address, initData);
    await buidlerProxy.deployed();

    await buidlerProxy.connect(owner).setImplementation(ACOFactoryV2.address, []);

    token1 = await (await ethers.getContractFactory("ERC20ForTest")).deploy(token1Name, token1Symbol, token1Decimals, token1TotalSupply);
    await token1.deployed();

    token2 = await (await ethers.getContractFactory("ERC20ForTest")).deploy(token2Name, token2Symbol, token2Decimals, token2TotalSupply);
    await token2.deployed();

    buidlerFactory = await ethers.getContractAt("ACOFactoryV2", buidlerProxy.address);

    time = Math.round(new Date().getTime() / 1000) + 86400;
    price1 = ethers.utils.bigNumberify("3000000");
    let tx = await (await buidlerFactory.createAcoToken(ethers.constants.AddressZero, token1.address, true, price1, time, maxExercisedAccounts)).wait();
    buidlerEthT1003C = await ethers.getContractAt("ACOToken", tx.events[tx.events.length - 1].args.acoToken);  

    tx = await (await buidlerFactory.createAcoToken(ethers.constants.AddressZero, token1.address, false, price1, time, maxExercisedAccounts)).wait();
    buidlerEthT1003P = await ethers.getContractAt("ACOToken", tx.events[tx.events.length - 1].args.acoToken); 

    price2 = ethers.utils.bigNumberify("10000000000000000000000");
    tx = await (await buidlerFactory.createAcoToken(token1.address, token2.address, false, price2, time, maxExercisedAccounts)).wait();
    buidlerT1T210000P = await ethers.getContractAt("ACOToken", tx.events[tx.events.length - 1].args.acoToken);  

    tx = await (await buidlerFactory.createAcoToken(token1.address, token2.address, true, price2, time, maxExercisedAccounts)).wait();
    buidlerT1T210000C = await ethers.getContractAt("ACOToken", tx.events[tx.events.length - 1].args.acoToken); 

    uniswapFactory = await (await ethers.getContractFactory("UniswapV2Factory")).deploy(await owner.getAddress());
    await uniswapFactory.deployed();

    weth = await (await ethers.getContractFactory("WETH9")).deploy();
    await weth.deployed(); 

    uniswapRouter = await (await ethers.getContractFactory("UniswapV2Router02")).deploy(uniswapFactory.address, weth.address);
    await uniswapRouter.deployed();

    flashExercise = await (await ethers.getContractFactory("ACOFlashExercise")).deploy(uniswapRouter.address);
    await flashExercise.deployed();

    await uniswapFactory.createPair(token1.address, token2.address);
    await uniswapFactory.createPair(token1.address, weth.address);

    pairToken1Token2 = await ethers.getContractAt("UniswapV2Pair", await uniswapFactory.getPair(token1.address, token2.address));
    pairToken1weth =  await ethers.getContractAt("UniswapV2Pair", await uniswapFactory.getPair(token1.address, weth.address));

    await token1.connect(owner).approve(pairToken1Token2.address, token1TotalSupply);
    await token1.connect(addr1).approve(pairToken1Token2.address, token1TotalSupply);
    await token1.connect(addr2).approve(pairToken1Token2.address, token1TotalSupply);
    await token1.connect(addr3).approve(pairToken1Token2.address, token1TotalSupply);
    await token1.connect(owner).approve(pairToken1weth.address, token1TotalSupply);
    await token1.connect(addr1).approve(pairToken1weth.address, token1TotalSupply);
    await token1.connect(addr2).approve(pairToken1weth.address, token1TotalSupply);
    await token1.connect(addr3).approve(pairToken1weth.address, token1TotalSupply);
    await token2.connect(owner).approve(pairToken1Token2.address, token2TotalSupply);
    await token2.connect(addr1).approve(pairToken1Token2.address, token2TotalSupply);
    await token2.connect(addr2).approve(pairToken1Token2.address, token2TotalSupply);
    await token2.connect(addr3).approve(pairToken1Token2.address, token2TotalSupply);

    await token1.connect(owner).transfer(pairToken1Token2.address, token1Liq);
    await token2.connect(owner).transfer(pairToken1Token2.address, token2Liq);
    await pairToken1Token2.connect(owner).mint(await owner.getAddress());
  
    await token1.connect(owner).transfer(pairToken1weth.address, token1Liq);
    await weth.connect(owner).deposit({value: wethLiq});
    await weth.connect(owner).transfer(pairToken1weth.address, wethLiq);
    await pairToken1weth.connect(owner).mint(await owner.getAddress());
  });

  describe("Flash exercise transactions", function () {
    it("Check flash exercise", async function () {
      let start1Balance = ethers.utils.bigNumberify("10000000000");
      await token1.transfer(await addr1.getAddress(), start1Balance);
      await token1.transfer(await addr2.getAddress(), start1Balance);
      await token1.transfer(await addr3.getAddress(), start1Balance);
      let start2Balance = ethers.utils.bigNumberify("10000000000000000000000");
      await token2.transfer(await addr1.getAddress(), start2Balance);
      await token2.transfer(await addr2.getAddress(), start2Balance);
      await token2.transfer(await addr3.getAddress(), start2Balance);
      let val1 = ethers.utils.bigNumberify("2000000000000000000");
      let val2 = ethers.utils.bigNumberify("4000000000000000000");
      let val3 = ethers.utils.bigNumberify("1000000000000000000");
      let precision1 = ethers.utils.bigNumberify("100000000");
      let value1 = ethers.utils.bigNumberify("2000000000000000000000");
      let value2 = ethers.utils.bigNumberify("4000000000000000000000");
      let value3 = ethers.utils.bigNumberify("1000000000000000000000");
      let amount1 = value1.mul(precision1).div(price2);
      let amount2 = value2.mul(precision1).div(price2);
      let amount3 = value3.mul(precision1).div(price2);
      let precision2 = ethers.utils.bigNumberify("1000000000000000000");
      let v1 = ethers.utils.bigNumberify("200000000");
      let v2 = ethers.utils.bigNumberify("400000000");
      let v3 = ethers.utils.bigNumberify("100000000");
      let a1 = v1.mul(precision2).div(price1);
      let a2 = v2.mul(precision2).div(price1);
      let a3 = v3.mul(precision2).div(price1);
      let one = ethers.utils.bigNumberify("1");

      await buidlerEthT1003C.connect(addr1).mintPayable({value: val1}); 
      await token2.connect(addr1).approve(buidlerT1T210000P.address, value1);
      await buidlerT1T210000P.connect(addr1).mint(value1); 
      await token1.connect(addr1).approve(buidlerEthT1003P.address, v1);
      await buidlerEthT1003P.connect(addr1).mint(v1); 

      await buidlerEthT1003C.connect(addr2).mintPayable({value: val2}); 
      await token2.connect(addr2).approve(buidlerT1T210000P.address, value2);
      await buidlerT1T210000P.connect(addr2).mint(value2); 
      await token1.connect(addr2).approve(buidlerEthT1003P.address, v2);
      await buidlerEthT1003P.connect(addr2).mint(v2); 

      await buidlerEthT1003C.connect(addr3).mintPayable({value: val3}); 
      await token2.connect(addr3).approve(buidlerT1T210000P.address, value3);
      await buidlerT1T210000P.connect(addr3).mint(value3);
      await token1.connect(addr3).approve(buidlerEthT1003P.address, v3);
      await buidlerEthT1003P.connect(addr3).mint(v3); 
      
      await buidlerEthT1003C.connect(addr1).transfer(await addr3.getAddress(), val3);
      await buidlerEthT1003C.connect(addr1).transfer(await owner.getAddress(), val3);
      await buidlerEthT1003C.connect(addr2).transfer(await addr3.getAddress(), val3);
      await buidlerEthT1003C.connect(addr2).transfer(await addr3.getAddress(), val3);
      await buidlerEthT1003C.connect(addr2).transfer(await addr3.getAddress(), val3);
      await buidlerT1T210000P.connect(addr1).transfer(await addr3.getAddress(), amount3);
      await buidlerT1T210000P.connect(addr1).transfer(await owner.getAddress(), amount3);
      await buidlerT1T210000P.connect(addr2).transfer(await addr3.getAddress(), amount3);
      await buidlerT1T210000P.connect(addr2).transfer(await addr3.getAddress(), amount3);
      await buidlerT1T210000P.connect(addr2).transfer(await addr3.getAddress(), amount3);
      await buidlerEthT1003P.connect(addr1).transfer(await addr3.getAddress(), a3);
      await buidlerEthT1003P.connect(addr1).transfer(await owner.getAddress(), a3);
      await buidlerEthT1003P.connect(addr2).transfer(await addr3.getAddress(), a3);
      await buidlerEthT1003P.connect(addr2).transfer(await addr3.getAddress(), a3);
      await buidlerEthT1003P.connect(addr2).transfer(await addr3.getAddress(), a3);
      
      expect(await buidlerEthT1003C.totalCollateral()).to.equal(val1.add(val2).add(val3));  
      expect(await buidlerEthT1003C.balanceOf(await addr1.getAddress())).to.equal(0); 
      expect(await buidlerEthT1003C.balanceOf(await addr2.getAddress())).to.equal(val3); 
      expect(await buidlerEthT1003C.balanceOf(await addr3.getAddress())).to.equal(val2.add(val3));
      expect(await buidlerEthT1003C.balanceOf(await owner.getAddress())).to.equal(val3);
      expect(await buidlerEthT1003C.currentCollateral(await addr1.getAddress())).to.equal(val1);
      expect(await buidlerEthT1003C.currentCollateral(await addr2.getAddress())).to.equal(val2);
      expect(await buidlerEthT1003C.currentCollateral(await addr3.getAddress())).to.equal(val3);
      expect(await buidlerEthT1003C.currentCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003C.unassignableCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerEthT1003C.unassignableCollateral(await addr2.getAddress())).to.equal(val3);
      expect(await buidlerEthT1003C.unassignableCollateral(await addr3.getAddress())).to.equal(val3);
      expect(await buidlerEthT1003C.unassignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003C.assignableCollateral(await addr1.getAddress())).to.equal(val1);
      expect(await buidlerEthT1003C.assignableCollateral(await addr2.getAddress())).to.equal(val3.add(val3).add(val3));
      expect(await buidlerEthT1003C.assignableCollateral(await addr3.getAddress())).to.equal(0);
      expect(await buidlerEthT1003C.assignableCollateral(await owner.getAddress())).to.equal(0);
      
      expect(await buidlerT1T210000P.totalCollateral()).to.equal(value1.add(value2).add(value3));  
      expect(await buidlerT1T210000P.balanceOf(await addr1.getAddress())).to.equal(0); 
      expect(await buidlerT1T210000P.balanceOf(await addr2.getAddress())).to.equal(amount3); 
      expect(await buidlerT1T210000P.balanceOf(await addr3.getAddress())).to.equal(amount2.add(amount3));
      expect(await buidlerT1T210000P.balanceOf(await owner.getAddress())).to.equal(amount3);
      expect(await buidlerT1T210000P.currentCollateral(await addr1.getAddress())).to.equal(value1);
      expect(await buidlerT1T210000P.currentCollateral(await addr2.getAddress())).to.equal(value2);
      expect(await buidlerT1T210000P.currentCollateral(await addr3.getAddress())).to.equal(value3);
      expect(await buidlerT1T210000P.currentCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerT1T210000P.unassignableCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerT1T210000P.unassignableCollateral(await addr2.getAddress())).to.equal(value3);
      expect(await buidlerT1T210000P.unassignableCollateral(await addr3.getAddress())).to.equal(value3);
      expect(await buidlerT1T210000P.unassignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerT1T210000P.assignableCollateral(await addr1.getAddress())).to.equal(value1);
      expect(await buidlerT1T210000P.assignableCollateral(await addr2.getAddress())).to.equal(value3.add(value3).add(value3));
      expect(await buidlerT1T210000P.assignableCollateral(await addr3.getAddress())).to.equal(0);
      expect(await buidlerT1T210000P.assignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await token2.balanceOf(await addr1.getAddress())).to.equal(start2Balance.sub(value1));
      expect(await token2.balanceOf(await addr2.getAddress())).to.equal(start2Balance.sub(value2));
      expect(await token2.balanceOf(await addr3.getAddress())).to.equal(start2Balance.sub(value3));

      expect(await buidlerEthT1003P.totalCollateral()).to.equal(v1.add(v2).add(v3));  
      expect(await buidlerEthT1003P.balanceOf(await addr1.getAddress())).to.equal(0); 
      expect(await buidlerEthT1003P.balanceOf(await addr2.getAddress())).to.equal(a2.sub(a3.mul(ethers.utils.bigNumberify("3")))); 
      expect(await buidlerEthT1003P.balanceOf(await addr3.getAddress())).to.equal(a3.add(a3.mul(ethers.utils.bigNumberify("4"))));
      expect(await buidlerEthT1003P.balanceOf(await owner.getAddress())).to.equal(a3);
      expect(await buidlerEthT1003P.currentCollateral(await addr1.getAddress())).to.equal(v1.sub(one));
      expect(await buidlerEthT1003P.currentCollateral(await addr2.getAddress())).to.equal(v2.sub(one));
      expect(await buidlerEthT1003P.currentCollateral(await addr3.getAddress())).to.equal(v3.sub(one));
      expect(await buidlerEthT1003P.currentCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.unassignableCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.unassignableCollateral(await addr2.getAddress())).to.equal(v3);
      expect(await buidlerEthT1003P.unassignableCollateral(await addr3.getAddress())).to.equal(v3.sub(one));
      expect(await buidlerEthT1003P.unassignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.assignableCollateral(await addr1.getAddress())).to.equal(v1.sub(one));
      expect(await buidlerEthT1003P.assignableCollateral(await addr2.getAddress())).to.equal(v3.add(v3).add(v3).sub(one));
      expect(await buidlerEthT1003P.assignableCollateral(await addr3.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.assignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await token1.balanceOf(await addr1.getAddress())).to.equal(start1Balance.sub(v1));
      expect(await token1.balanceOf(await addr2.getAddress())).to.equal(start1Balance.sub(v2));
      expect(await token1.balanceOf(await addr3.getAddress())).to.equal(start1Balance.sub(v3));

      let e1 = val3.mul(price1).div(precision2);
      expect((await buidlerEthT1003C.getBaseExerciseData(val3))[1]).to.equal(e1);  
      await buidlerEthT1003C.connect(owner).approve(flashExercise.address, val3);
      let b1 = await addr2.getBalance();
      let exp1 = await flashExercise.getEstimatedReturn(buidlerEthT1003C.address, val3);
      await flashExercise.connect(owner).flashExercise(buidlerEthT1003C.address, val3, exp1, 1);

      expect(await buidlerEthT1003C.totalCollateral()).to.equal(val1.add(val2));  
      expect(await buidlerEthT1003C.balanceOf(await addr1.getAddress())).to.equal(0); 
      expect(await buidlerEthT1003C.balanceOf(await addr2.getAddress())).to.equal(val3); 
      expect(await buidlerEthT1003C.balanceOf(await addr3.getAddress())).to.equal(val2.add(val3));
      expect(await buidlerEthT1003C.balanceOf(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003C.currentCollateral(await addr1.getAddress())).to.equal(val1);
      expect(await buidlerEthT1003C.currentCollateral(await addr2.getAddress())).to.equal(val2.sub(val3));
      expect(await buidlerEthT1003C.currentCollateral(await addr3.getAddress())).to.equal(val3);
      expect(await buidlerEthT1003C.currentCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003C.unassignableCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerEthT1003C.unassignableCollateral(await addr2.getAddress())).to.equal(val3);
      expect(await buidlerEthT1003C.unassignableCollateral(await addr3.getAddress())).to.equal(val3);
      expect(await buidlerEthT1003C.unassignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003C.assignableCollateral(await addr1.getAddress())).to.equal(val1);
      expect(await buidlerEthT1003C.assignableCollateral(await addr2.getAddress())).to.equal(val3.add(val3));
      expect(await buidlerEthT1003C.assignableCollateral(await addr3.getAddress())).to.equal(0);
      expect(await buidlerEthT1003C.assignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await token1.balanceOf(await addr1.getAddress())).to.equal(start1Balance.sub(v1));
      expect(await token1.balanceOf(await addr2.getAddress())).to.equal(start1Balance.sub(v2).add(e1).add(1));
      expect(await token1.balanceOf(await addr3.getAddress())).to.equal(start1Balance.sub(v3));
      expect(await token1.balanceOf(await owner.getAddress())).to.equal(token1TotalSupply.sub(token1Liq.mul(2)).sub(start1Balance.mul(3)));
      expect(await token2.balanceOf(await addr1.getAddress())).to.equal(start2Balance.sub(value1));
      expect(await token2.balanceOf(await addr2.getAddress())).to.equal(start2Balance.sub(value2));
      expect(await token2.balanceOf(await addr3.getAddress())).to.equal(start2Balance.sub(value3));
      expect(await token2.balanceOf(await owner.getAddress())).to.equal(token2TotalSupply.sub(token2Liq).sub(start2Balance.mul(3)));
      expect(await addr2.getBalance()).to.equal(b1.add(val3.mul(fee).div(100000)));

      expect((await buidlerT1T210000P.getBaseExerciseData(amount3))[1]).to.equal(amount3);  
      await buidlerT1T210000P.connect(owner).approve(flashExercise.address, amount3);
      let exp2 = await flashExercise.getEstimatedReturn(buidlerT1T210000P.address, amount3);
      await flashExercise.connect(owner).flashExercise(buidlerT1T210000P.address, amount3, exp2, 1);
      let fee2 = value3.mul(fee).div(100000);

      expect(await buidlerT1T210000P.totalCollateral()).to.equal(value1.add(value2));  
      expect(await buidlerT1T210000P.balanceOf(await addr1.getAddress())).to.equal(0); 
      expect(await buidlerT1T210000P.balanceOf(await addr2.getAddress())).to.equal(amount3); 
      expect(await buidlerT1T210000P.balanceOf(await addr3.getAddress())).to.equal(amount2.add(amount3));
      expect(await buidlerT1T210000P.balanceOf(await owner.getAddress())).to.equal(0);
      expect(await buidlerT1T210000P.currentCollateral(await addr1.getAddress())).to.equal(value1);
      expect(await buidlerT1T210000P.currentCollateral(await addr2.getAddress())).to.equal(value2.sub(value3));
      expect(await buidlerT1T210000P.currentCollateral(await addr3.getAddress())).to.equal(value3);
      expect(await buidlerT1T210000P.currentCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerT1T210000P.unassignableCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerT1T210000P.unassignableCollateral(await addr2.getAddress())).to.equal(value3);
      expect(await buidlerT1T210000P.unassignableCollateral(await addr3.getAddress())).to.equal(value3);
      expect(await buidlerT1T210000P.unassignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerT1T210000P.assignableCollateral(await addr1.getAddress())).to.equal(value1);
      expect(await buidlerT1T210000P.assignableCollateral(await addr2.getAddress())).to.equal(value3.add(value3));
      expect(await buidlerT1T210000P.assignableCollateral(await addr3.getAddress())).to.equal(0);
      expect(await buidlerT1T210000P.assignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await token1.balanceOf(await addr1.getAddress())).to.equal(start1Balance.sub(v1));
      expect(await token1.balanceOf(await addr2.getAddress())).to.equal(start1Balance.sub(v2).add(e1).add(amount3).add(1).add(1));
      expect(await token1.balanceOf(await addr3.getAddress())).to.equal(start1Balance.sub(v3));
      expect(await token1.balanceOf(await owner.getAddress())).to.equal(token1TotalSupply.sub(token1Liq.mul(2)).sub(start1Balance.mul(3)));
      expect(await token2.balanceOf(await addr1.getAddress())).to.equal(start2Balance.sub(value1));
      expect(await token2.balanceOf(await addr2.getAddress())).to.equal(start2Balance.sub(value2).add(fee2));
      expect(await token2.balanceOf(await addr3.getAddress())).to.equal(start2Balance.sub(value3));
      expect(await token2.balanceOf(await owner.getAddress())).to.equal(token2TotalSupply.sub(token2Liq).sub(start2Balance.mul(3)).add(exp2));

      await token1.connect(owner).transfer(pairToken1weth.address, token1Liq);
      await weth.connect(owner).deposit({value: wethLiq.mul(2)});
      await weth.connect(owner).transfer(pairToken1weth.address, wethLiq.mul(2));
      await pairToken1weth.connect(owner).mint(await owner.getAddress());

      expect((await buidlerEthT1003P.getBaseExerciseData(a3))[1]).to.equal(a3);  
      await buidlerEthT1003P.connect(owner).approve(flashExercise.address, a3);
      let exp3 = await flashExercise.getEstimatedReturn(buidlerEthT1003P.address, a3);
      await flashExercise.connect(owner).flashExercise(buidlerEthT1003P.address, a3, exp3, 1);
      let fee3 = v3.mul(fee).div(100000);
 
      expect(await buidlerEthT1003P.totalCollateral()).to.equal(v1.add(v2).add(one));  
      expect(await buidlerEthT1003P.balanceOf(await addr1.getAddress())).to.equal(0); 
      expect(await buidlerEthT1003P.balanceOf(await addr2.getAddress())).to.equal(a2.sub(a3.mul(3))); 
      expect(await buidlerEthT1003P.balanceOf(await addr3.getAddress())).to.equal(a3.add(a3.mul(4)));
      expect(await buidlerEthT1003P.balanceOf(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.currentCollateral(await addr1.getAddress())).to.equal(v1.sub(one));
      expect(await buidlerEthT1003P.currentCollateral(await addr2.getAddress())).to.equal(v2.sub(v3));
      expect(await buidlerEthT1003P.currentCollateral(await addr3.getAddress())).to.equal(v3.sub(one));
      expect(await buidlerEthT1003P.currentCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.unassignableCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.unassignableCollateral(await addr2.getAddress())).to.equal(v3);
      expect(await buidlerEthT1003P.unassignableCollateral(await addr3.getAddress())).to.equal(v3.sub(one));
      expect(await buidlerEthT1003P.unassignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.assignableCollateral(await addr1.getAddress())).to.equal(v1.sub(one));
      expect(await buidlerEthT1003P.assignableCollateral(await addr2.getAddress())).to.equal(v3.add(v3).sub(one));
      expect(await buidlerEthT1003P.assignableCollateral(await addr3.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.assignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await token1.balanceOf(await addr1.getAddress())).to.equal(start1Balance.sub(v1));
      expect(await token1.balanceOf(await addr2.getAddress())).to.equal(start1Balance.sub(v2).add(e1).add(amount3).add(fee3).sub(one).add(1).add(1));
      expect(await token1.balanceOf(await addr3.getAddress())).to.equal(start1Balance.sub(v3));
      expect(await token1.balanceOf(await owner.getAddress())).to.equal(token1TotalSupply.sub(token1Liq.mul(3)).sub(start1Balance.mul(3)).add(exp3));
      expect(await token2.balanceOf(await addr1.getAddress())).to.equal(start2Balance.sub(value1));
      expect(await token2.balanceOf(await addr2.getAddress())).to.equal(start2Balance.sub(value2).add(fee2));
      expect(await token2.balanceOf(await addr3.getAddress())).to.equal(start2Balance.sub(value3));
      expect(await token2.balanceOf(await owner.getAddress())).to.equal(token2TotalSupply.sub(token2Liq).sub(start2Balance.mul(3)).add(exp2));
    });
    it("Check flash exercise accounts", async function () {
      let start1Balance = ethers.utils.bigNumberify("10000000000");
      await token1.transfer(await addr1.getAddress(), start1Balance);
      await token1.transfer(await addr2.getAddress(), start1Balance);
      await token1.transfer(await addr3.getAddress(), start1Balance);
      let start2Balance = ethers.utils.bigNumberify("10000000000000000000000");
      await token2.transfer(await addr1.getAddress(), start2Balance);
      await token2.transfer(await addr2.getAddress(), start2Balance);
      await token2.transfer(await addr3.getAddress(), start2Balance);
      let precision1 = ethers.utils.bigNumberify("100000000");
      let precision2 = ethers.utils.bigNumberify("1000000000000000000");
      let v1 = ethers.utils.bigNumberify("100000000");
      let v2 = ethers.utils.bigNumberify("200000000");
      let v3 = ethers.utils.bigNumberify("300000000");
      let a1 = v1.mul(precision2).div(price1);
      let a2 = v2.mul(precision2).div(price1);
      let a3 = v3.mul(precision2).div(price1);
      
      await token1.connect(addr1).approve(buidlerEthT1003P.address, v1);
      await token1.connect(addr2).approve(buidlerEthT1003P.address, v2);
      await token1.connect(addr3).approve(buidlerEthT1003P.address, v3);
      await buidlerEthT1003P.connect(addr1).mint(v1); 
      await buidlerEthT1003P.connect(addr2).mint(v2); 
      await buidlerEthT1003P.connect(addr3).mint(v3); 
      await token1.connect(addr1).approve(buidlerT1T210000C.address, v1);
      await token1.connect(addr2).approve(buidlerT1T210000C.address, v2);
      await token1.connect(addr3).approve(buidlerT1T210000C.address, v3);
      await buidlerT1T210000C.connect(addr1).mint(v1); 
      await buidlerT1T210000C.connect(addr2).mint(v2); 
      await buidlerT1T210000C.connect(addr3).mint(v3); 

      await buidlerEthT1003P.connect(addr1).transfer(await owner.getAddress(), a1);
      await buidlerEthT1003P.connect(addr2).transfer(await owner.getAddress(), a1);
      await buidlerEthT1003P.connect(addr3).transfer(await owner.getAddress(), a3);
      await buidlerT1T210000C.connect(addr1).transfer(await owner.getAddress(), v1);
      await buidlerT1T210000C.connect(addr2).transfer(await owner.getAddress(), v1);
      await buidlerT1T210000C.connect(addr3).transfer(await owner.getAddress(), v3);
      
      expect(await buidlerEthT1003P.totalCollateral()).to.equal(v1.add(v2).add(v3));  
      expect(await buidlerEthT1003P.balanceOf(await addr1.getAddress())).to.equal(0); 
      expect(await buidlerEthT1003P.balanceOf(await addr2.getAddress())).to.equal(a2.sub(a1)); 
      expect(await buidlerEthT1003P.balanceOf(await addr3.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.balanceOf(await owner.getAddress())).to.equal(a1.add(a1).add(a3));
      expect(await buidlerEthT1003P.currentCollateral(await addr1.getAddress())).to.equal(v1.sub(1));
      expect(await buidlerEthT1003P.currentCollateral(await addr2.getAddress())).to.equal(v2.sub(1));
      expect(await buidlerEthT1003P.currentCollateral(await addr3.getAddress())).to.equal(v3);
      expect(await buidlerEthT1003P.currentCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.unassignableCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.unassignableCollateral(await addr2.getAddress())).to.equal(v2.sub(v1).sub(1));
      expect(await buidlerEthT1003P.unassignableCollateral(await addr3.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.unassignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.assignableCollateral(await addr1.getAddress())).to.equal(v1.sub(1));
      expect(await buidlerEthT1003P.assignableCollateral(await addr2.getAddress())).to.equal(v1.sub(1));
      expect(await buidlerEthT1003P.assignableCollateral(await addr3.getAddress())).to.equal(v3);
      expect(await buidlerEthT1003P.assignableCollateral(await owner.getAddress())).to.equal(0);
      
      expect(await buidlerT1T210000C.totalCollateral()).to.equal(v1.add(v2).add(v3));  
      expect(await buidlerT1T210000C.balanceOf(await addr1.getAddress())).to.equal(0); 
      expect(await buidlerT1T210000C.balanceOf(await addr2.getAddress())).to.equal(v2.sub(v1)); 
      expect(await buidlerT1T210000C.balanceOf(await addr3.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.balanceOf(await owner.getAddress())).to.equal(v3.add(v1).add(v1));
      expect(await buidlerT1T210000C.currentCollateral(await addr1.getAddress())).to.equal(v1);
      expect(await buidlerT1T210000C.currentCollateral(await addr2.getAddress())).to.equal(v2);
      expect(await buidlerT1T210000C.currentCollateral(await addr3.getAddress())).to.equal(v3);
      expect(await buidlerT1T210000C.currentCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.unassignableCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.unassignableCollateral(await addr2.getAddress())).to.equal(v2.sub(v1));
      expect(await buidlerT1T210000C.unassignableCollateral(await addr3.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.unassignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.assignableCollateral(await addr1.getAddress())).to.equal(v1);
      expect(await buidlerT1T210000C.assignableCollateral(await addr2.getAddress())).to.equal(v1);
      expect(await buidlerT1T210000C.assignableCollateral(await addr3.getAddress())).to.equal(v3);
      expect(await buidlerT1T210000C.assignableCollateral(await owner.getAddress())).to.equal(0);

      expect(await token1.balanceOf(await addr1.getAddress())).to.equal(start1Balance.sub(v1).sub(v1));
      expect(await token1.balanceOf(await addr2.getAddress())).to.equal(start1Balance.sub(v2).sub(v2));
      expect(await token1.balanceOf(await addr3.getAddress())).to.equal(start1Balance.sub(v3).sub(v3));
      expect(await token2.balanceOf(await addr1.getAddress())).to.equal(start2Balance);
      expect(await token2.balanceOf(await addr2.getAddress())).to.equal(start2Balance);
      expect(await token2.balanceOf(await addr3.getAddress())).to.equal(start2Balance);

      let e1 = (v1.add(v1)).mul(price2).div(precision1);
      expect((await buidlerEthT1003P.getBaseExerciseData(a1.add(a1)))[1]).to.equal(a1.add(a1)); 
      expect((await buidlerT1T210000C.getBaseExerciseData(v1.add(v1)))[1]).to.equal(e1);  

      await token1.connect(owner).transfer(pairToken1weth.address, token1Liq);
      await weth.connect(owner).deposit({value: wethLiq.mul(2)});
      await weth.connect(owner).transfer(pairToken1weth.address, wethLiq.mul(2));
      await pairToken1weth.connect(owner).mint(await owner.getAddress());

      let b1 = await addr1.getBalance();
      let b2 = await addr2.getBalance();
      let b3 = await addr3.getBalance();
      
      await buidlerEthT1003P.connect(owner).approve(flashExercise.address, a1.add(a1));
      let exp1 = await flashExercise.getEstimatedReturn(buidlerEthT1003P.address, a1.add(a1));
      await flashExercise.connect(owner).flashExerciseAccounts(buidlerEthT1003P.address, a1.add(a1), exp1, [await addr2.getAddress(), await addr1.getAddress()]);
      let fee1 = v1.add(v1).mul(fee).div(100000);

      expect(await buidlerEthT1003P.totalCollateral()).to.equal(v1.add(v3).add(1));  
      expect(await buidlerEthT1003P.balanceOf(await addr1.getAddress())).to.equal(0); 
      expect(await buidlerEthT1003P.balanceOf(await addr2.getAddress())).to.equal(a2.sub(a1)); 
      expect(await buidlerEthT1003P.balanceOf(await addr3.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.balanceOf(await owner.getAddress())).to.equal(a3);
      expect(await buidlerEthT1003P.currentCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.currentCollateral(await addr2.getAddress())).to.equal(v1.sub(1));
      expect(await buidlerEthT1003P.currentCollateral(await addr3.getAddress())).to.equal(v3);
      expect(await buidlerEthT1003P.currentCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.unassignableCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.unassignableCollateral(await addr2.getAddress())).to.equal(v1.sub(1));
      expect(await buidlerEthT1003P.unassignableCollateral(await addr3.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.unassignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.assignableCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.assignableCollateral(await addr2.getAddress())).to.equal(0);
      expect(await buidlerEthT1003P.assignableCollateral(await addr3.getAddress())).to.equal(v3);
      expect(await buidlerEthT1003P.assignableCollateral(await owner.getAddress())).to.equal(0);

      expect(await token1.balanceOf(await addr1.getAddress())).to.equal(start1Balance.sub(v1).sub(v1));
      expect(await token1.balanceOf(await addr2.getAddress())).to.equal(start1Balance.sub(v2).sub(v2).add(fee1).sub(1));
      expect(await token1.balanceOf(await addr3.getAddress())).to.equal(start1Balance.sub(v3).sub(v3));
      expect(await token1.balanceOf(await owner.getAddress())).to.equal(token1TotalSupply.sub(token1Liq.mul(3)).sub(start1Balance.mul(3)).add(exp1));
      expect(await token2.balanceOf(await addr1.getAddress())).to.equal(start2Balance);
      expect(await token2.balanceOf(await addr2.getAddress())).to.equal(start2Balance);
      expect(await token2.balanceOf(await addr3.getAddress())).to.equal(start2Balance);
      expect(await token2.balanceOf(await owner.getAddress())).to.equal(token2TotalSupply.sub(token2Liq).sub(start2Balance.mul(3)));
      expect(await addr1.getBalance()).to.equal(b1.add(a1).add(1));
      expect(await addr2.getBalance()).to.equal(b2.add(a1).add(1));
      expect(await addr3.getBalance()).to.equal(b3);

      await token1.connect(owner).transfer(pairToken1Token2.address, token1Liq);
      await token2.connect(owner).transfer(pairToken1Token2.address, token2Liq.mul(2));
      await pairToken1Token2.connect(owner).mint(await owner.getAddress());

      await buidlerT1T210000C.connect(owner).approve(flashExercise.address, v1.add(v1));
      let exp2 = await flashExercise.getEstimatedReturn(buidlerT1T210000C.address, v1.add(v1));
      await flashExercise.connect(owner).flashExerciseAccounts(buidlerT1T210000C.address, v1.add(v1), exp2, [await addr2.getAddress(), await addr1.getAddress()]);
      
      expect(await buidlerT1T210000C.totalCollateral()).to.equal(v1.add(v3));  
      expect(await buidlerT1T210000C.balanceOf(await addr1.getAddress())).to.equal(0); 
      expect(await buidlerT1T210000C.balanceOf(await addr2.getAddress())).to.equal(v1); 
      expect(await buidlerT1T210000C.balanceOf(await addr3.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.balanceOf(await owner.getAddress())).to.equal(v3);
      expect(await buidlerT1T210000C.currentCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.currentCollateral(await addr2.getAddress())).to.equal(v1);
      expect(await buidlerT1T210000C.currentCollateral(await addr3.getAddress())).to.equal(v3);
      expect(await buidlerT1T210000C.currentCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.unassignableCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.unassignableCollateral(await addr2.getAddress())).to.equal(v1);
      expect(await buidlerT1T210000C.unassignableCollateral(await addr3.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.unassignableCollateral(await owner.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.assignableCollateral(await addr1.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.assignableCollateral(await addr2.getAddress())).to.equal(0);
      expect(await buidlerT1T210000C.assignableCollateral(await addr3.getAddress())).to.equal(v3);
      expect(await buidlerT1T210000C.assignableCollateral(await owner.getAddress())).to.equal(0);

      expect(await token1.balanceOf(await addr1.getAddress())).to.equal(start1Balance.sub(v1).sub(v1));
      expect(await token1.balanceOf(await addr2.getAddress())).to.equal(start1Balance.sub(v2).sub(v2).add(fee1).sub(1).add(fee1));
      expect(await token1.balanceOf(await addr3.getAddress())).to.equal(start1Balance.sub(v3).sub(v3));
      expect(await token1.balanceOf(await owner.getAddress())).to.equal(token1TotalSupply.sub(token1Liq.mul(4)).sub(start1Balance.mul(3)).add(exp1).add(exp2));
      expect(await token2.balanceOf(await addr1.getAddress())).to.equal(start2Balance.add(e1.div(2)).add(1));
      expect(await token2.balanceOf(await addr2.getAddress())).to.equal(start2Balance.add(e1.div(2)).add(1));
      expect(await token2.balanceOf(await addr3.getAddress())).to.equal(start2Balance);
      expect(await token2.balanceOf(await owner.getAddress())).to.equal(token2TotalSupply.sub(token2Liq.mul(3)).sub(start2Balance.mul(3)));
      expect(await addr1.getBalance()).to.equal(b1.add(a1).add(1));
      expect(await addr2.getBalance()).to.equal(b2.add(a1).add(1));
      expect(await addr3.getBalance()).to.equal(b3);
    });
    it("Check fail to flash exercise", async function () {
      let start1Balance = ethers.utils.bigNumberify("10000000000");
      await token1.transfer(await addr1.getAddress(), start1Balance);
      await token1.transfer(await addr2.getAddress(), start1Balance);
      await token1.transfer(await addr3.getAddress(), start1Balance);
      let start2Balance = ethers.utils.bigNumberify("10000000000000000000000");
      await token2.transfer(await addr1.getAddress(), start2Balance);
      await token2.transfer(await addr2.getAddress(), start2Balance);
      await token2.transfer(await addr3.getAddress(), start2Balance);
      let val1 = ethers.utils.bigNumberify("2000000000000000000");
      let val2 = ethers.utils.bigNumberify("4000000000000000000");
      let val3 = ethers.utils.bigNumberify("1000000000000000000");
      let precision1 = ethers.utils.bigNumberify("100000000");
      let value1 = ethers.utils.bigNumberify("2000000000000000000000");
      let value2 = ethers.utils.bigNumberify("4000000000000000000000");
      let value3 = ethers.utils.bigNumberify("1000000000000000000000");
      let amount1 = value1.mul(precision1).div(price2);
      let amount2 = value2.mul(precision1).div(price2);
      let amount3 = value3.mul(precision1).div(price2);
      let precision2 = ethers.utils.bigNumberify("1000000000000000000");
      let v1 = ethers.utils.bigNumberify("200000000");
      let v2 = ethers.utils.bigNumberify("400000000");
      let v3 = ethers.utils.bigNumberify("100000000");
      let a1 = v1.mul(precision2).div(price1);
      let a2 = v2.mul(precision2).div(price1);
      let a3 = v3.mul(precision2).div(price1);
      let one = ethers.utils.bigNumberify("1");

      await buidlerEthT1003C.connect(addr1).mintPayable({value: val1}); 
      await token2.connect(addr1).approve(buidlerT1T210000P.address, value1);
      await buidlerT1T210000P.connect(addr1).mint(value1); 
      await token1.connect(addr1).approve(buidlerEthT1003P.address, v1);
      await buidlerEthT1003P.connect(addr1).mint(v1); 

      await buidlerEthT1003C.connect(addr2).mintPayable({value: val2}); 
      await token2.connect(addr2).approve(buidlerT1T210000P.address, value2);
      await buidlerT1T210000P.connect(addr2).mint(value2); 
      await token1.connect(addr2).approve(buidlerEthT1003P.address, v2);
      await buidlerEthT1003P.connect(addr2).mint(v2); 

      await buidlerEthT1003C.connect(addr3).mintPayable({value: val3}); 
      await token2.connect(addr3).approve(buidlerT1T210000P.address, value3);
      await buidlerT1T210000P.connect(addr3).mint(value3);
      await token1.connect(addr3).approve(buidlerEthT1003P.address, v3);
      await buidlerEthT1003P.connect(addr3).mint(v3); 
      
      await buidlerEthT1003C.connect(addr1).transfer(await addr3.getAddress(), val3);
      await buidlerEthT1003C.connect(addr1).transfer(await owner.getAddress(), val3);
      await buidlerEthT1003C.connect(addr2).transfer(await addr3.getAddress(), val3);
      await buidlerEthT1003C.connect(addr2).transfer(await addr3.getAddress(), val3);
      await buidlerEthT1003C.connect(addr2).transfer(await addr3.getAddress(), val3);
      await buidlerT1T210000P.connect(addr1).transfer(await addr3.getAddress(), amount3);
      await buidlerT1T210000P.connect(addr1).transfer(await owner.getAddress(), amount3);
      await buidlerT1T210000P.connect(addr2).transfer(await addr3.getAddress(), amount3);
      await buidlerT1T210000P.connect(addr2).transfer(await addr3.getAddress(), amount3);
      await buidlerT1T210000P.connect(addr2).transfer(await addr3.getAddress(), amount3);
      await buidlerEthT1003P.connect(addr1).transfer(await addr3.getAddress(), a3);
      await buidlerEthT1003P.connect(addr1).transfer(await owner.getAddress(), a3);
      await buidlerEthT1003P.connect(addr2).transfer(await addr3.getAddress(), a3);
      await buidlerEthT1003P.connect(addr2).transfer(await addr3.getAddress(), a3);
      await buidlerEthT1003P.connect(addr2).transfer(await addr3.getAddress(), a3);
      
      tx = await (await buidlerFactory.createAcoToken(ethers.constants.AddressZero, token2.address, true, price2, time, maxExercisedAccounts)).wait();
      let buidlerEthT210000C = await ethers.getContractAt("ACOToken", tx.events[tx.events.length - 1].args.acoToken); 

      await expect(
        flashExercise.connect(owner).flashExercise(buidlerEthT210000C.address, val3, 0, 0)
      ).to.be.revertedWith("ACOFlashExercise::_flashExercise: Invalid Uniswap pair");

      let exp1 = await flashExercise.getEstimatedReturn(buidlerEthT1003C.address, val3);
      
      await expect(
        flashExercise.connect(owner).flashExercise(buidlerEthT1003C.address, val3, exp1, 0)
      ).to.be.revertedWith("SafeMath: subtraction overflow");

      await expect(
        flashExercise.connect(owner).flashExerciseAccounts(buidlerEthT1003C.address, val3, exp1, [await addr2.getAddress(), await addr1.getAddress(), await addr3.getAddress()])
      ).to.be.revertedWith("SafeMath: subtraction overflow");

      await expect(
        flashExercise.connect(owner).flashExercise(buidlerEthT1003P.address, a1.add(a1), 0, 0)
      ).to.be.revertedWith("ACOFlashExercise::uniswapV2Call: Insufficient collateral amount");

      await expect(
        flashExercise.connect(owner).flashExerciseAccounts(buidlerEthT1003P.address, a1.add(a1), 0, [await addr2.getAddress(), await addr1.getAddress()])
      ).to.be.revertedWith("ACOFlashExercise::uniswapV2Call: Insufficient collateral amount");

      await buidlerEthT1003C.connect(owner).approve(flashExercise.address, val3);

      await expect(
        flashExercise.connect(owner).flashExercise(buidlerEthT1003C.address, val3, exp1.add(1), 0)
      ).to.be.revertedWith("ACOFlashExercise::uniswapV2Call: Minimum amount not satisfied");

      await expect(
        flashExercise.connect(owner).flashExerciseAccounts(buidlerEthT1003C.address, val3, exp1, [])
      ).to.be.revertedWith("ACOFlashExercise::flashExerciseAccounts: Accounts are required");

      await network.provider.send("evm_increaseTime", [86400]);

      await expect(
        flashExercise.connect(owner).flashExercise(buidlerEthT1003C.address, val3, exp1, 0)
      ).to.be.revertedWith("ACOToken::Expired");

      await expect(
        flashExercise.connect(owner).flashExerciseAccounts(buidlerEthT1003C.address, val3, exp1, [await addr2.getAddress(), await addr1.getAddress()])
      ).to.be.revertedWith("ACOToken::Expired");

      await network.provider.send("evm_increaseTime", [-86400]);
    });
  });
});