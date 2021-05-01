pragma solidity ^0.8.0;

contract Token {

  address staking_address;
  address onwer;

  mapping (address => uint256) genesis_allocation;
  uint256 genesis_total_amount;
  bool genesis_lp_send;
  uint256[][] farm_config;
  address lp_address;
  address[] manager_list;

  uint256 start_date;
  uint256 end_date;

  /*
  _genesis_address_list 和 _genesis_amount 共同构成 genesis_allocation 创世分配方式
  genesis_total_amount 记录总数

  farm_config_day 和  farm_config_amount 共同构成 farm_config 挖矿数量参数
  比如
  farm_config_day = [730, 365，365]
  farm_config_amount = [10*(10**18), 5*(10**18), 2.5*(10**18)]
  farm_config = [ [730, 10*(10**18)], [365, 5*(10**18)], [365, 2.5*(10**18)]]
  表示
    前 730 天作为第一个阶段，每天挖矿数量是 10*(10**18)
    后续 365 作为第二个周期，每天挖矿数量是 5*(10**18)
    后续 365 作为第三个周期，每天挖矿数量是 2.5*(10**18)
  TODO 挖矿规则的表达形式待定

  staking_address 质押合约地址

  onwer 合约所有者
  */
  constructor(
    address[] memory _genesis_address_list, uint256[] memory _genesis_amount,
    uint256[] memory farm_config_day, uint256[] memory farm_config_amount,
    address _staking_address,
    address _onwer
  ) {
    // TODO
  }

  /**
  设置 LP 地址
  lp_address 指的是 uniswap v3 上 this_token/eth 交易对的 地址
  权限 onwer
  */
  function set_lp_address(address _lp_address) public {
    // TODO
  }

  /**
  https://github.com/Uniswap/uniswap-v3-core/blob/main/contracts/interfaces/pool/IUniswapV3PoolActions.sol mint 方法

  创世纪LP提交
  把 genesis_total_amount 数量的 token 通过 mint 质押到 LP
  这个方法只能执行一次
  权限 onwer
  */
  function send_genesis_lp(int24 tickLower, int24 tickUpper) public {
    // TODO
  }

  /**
  增加管理员
  权限 onwer
  */
  function add_manager(address manager) public {
    // TODO set manager_list
  }

  /**
  删除管理员
  权限 onwer
  */
  function remove_manager(address manager) public {
    // TODO set manager_list
  }

  /**
  发行总量是一个变化的值，根据创世数量和后续挖矿产生的数量有关
  */
  function totalSupply() public view virtual returns (uint256) {
    // TODO
  }

  /**
  挖矿
  包括三部分
  1. 贡献者分配本次挖矿数量的 49%
  2. 质押合约分配本次挖矿数量的 1%(合约部署后的两年内，这个时间范围暂时待定为两年)
  3. 剩下的 50% 单币质押到 uniswap v3 lp 中

  address_list 本次挖矿的贡献者地址
  weight_list  本次挖矿的贡献者获取token权重 (分配本次挖矿总数的 49%)

  _end_date 代表 UTC 时间戳
  挖矿周期按照  start_date 到 end_date 算

  挖出的数量等于 farm_config_amount * (end_date - start_date).days

  tickLower 和 tickUpper 对应 uniswap v3 lp 的 range 参数
  权限 mamanger
  */
  function farm(
    address[] memory address_list, uint256[] memory weight_list,
    uint256 _end_date,
    int24 tickLower, int24 tickUpper
  ) public {
    // TODO
  }

}
