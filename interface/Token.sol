pragma solidity ^0.8.0;

/*
需求如下
1. 标准的 erc20 合约
2. 合约创世时，需要产生一些 创世 token，这些 token 分成两部分 两部分比例是 100 比 lp_ratio
  权重 100 的份额分配给 创世传入的分配地址
  权重 lp_ratio 的份额，在后续需要一次性放入 uni v3 lp 池（单币放入）
3. lp_ratio 需要初始化时，设置，后续不可以修改
4. totalSupply 是个变化的值，根据创世 + 挖出来的数量决定
5. 管理员可以调用挖矿接口，所以要可以设置管理员名单
6. 挖矿接口，按照 100：lp_ratio 分配出去，100 分配贡献者，lp_ratio 进入 lp 池，需要注意：uni v3 lp 是单币进去
7. 挖矿速度，需要初始化时设置，部署后不可以修改，速度指的是：每天可以挖出多少新token，可以是随着时间增加，每天的新token会变化，可以是一个公式
8. 提取手续费问题

问题：
1. 创世LP ，他不放怎么办，是否要在第一次挖矿时，强制调用 创世放入LP的逻辑
2. LP 池的创建流程 UE 如何设计
  比如 在第一次调用挖矿合约的时候，发一些类似EHT的单币来创建 LP 池
    或者 token 部署时，发一些类似ETH的单币来创建LP池
  
3. 从 LP 里把手续费提取的逻辑放在哪里执行，放入挖矿接口的话，多久提一次比较合适，以及提取权限的问题
4. 公式如何表示
5. 手续费应该有两种吧
*/
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
  TODO 挖矿规则的表达形式待定 farm_config_day 和 farm_config_amount 有更好的形式，待讨论确定，可以是一个私有方法描述规则

  lp_ratio 表示 每次挖矿 lp 的份额占的比例
  比如 lp_ratio 是 120
  那么每次挖矿出来的三部分分配权重如下
    贡献者     98（固定）
    进入质押    2（固定）
    进入lp   120（根据 lp_ratio 数值决定）

  staking_address 质押合约地址

  onwer 合约所有者
  */
  constructor(
    address[] memory _genesis_address_list, uint256[] memory _genesis_amount,
    uint256[] memory farm_config_day, uint256[] memory farm_config_amount,
    uint8 lp_ratio,
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
