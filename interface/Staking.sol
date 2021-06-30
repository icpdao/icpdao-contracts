pragma solidity ^0.8.0;

/*
质押合约的基础逻辑
1. 用户需要主动选择一个有限的分红列表，列表长度不做业务限制，但是需要提醒用户长度太长的弊端
2. 用户需要分两部完成质押和分红
  1. 先质押一定数量 ICPDAO
  2. 增加分红列表


举例说明
假设有 tokena 这种 dao token

1. tokena 的挖矿接口内，会把挖矿的 1% 转账给 Staking，这个动作只会影响 Staking 的 tokena 余额，不会改变 Staking 合约的任何其他内容
2. 用户会通过 UI 界面，向 Staking 质押一定数量的 ICPDAO
3. 已经质押了 ICPDAO 的用户，会通过 UI 界面，单独增加或者减少自己要获取分红的 token 列表，比如把 tokena 放进去
4. 用户给分红列表，增加 tokena 或 减少 tokena 时，会影响 PoolInfo 中的如下数据

  如下这个数值，和 tokena 余额配合计算，起到计算挖矿数量的作用
  last_farm_balances_amount  每次分红后，记录一下 Staking 的 tokena 余额快照
  详细介绍：
    余额 - last_farm_balances_amount 就是还没有进行分配的分红

  如下三个数值的作用类似于 标准二池的作用
  user_staking_icpdao_amount
  accTokenPerShare
  reward_debts

  这两个数据同步更新，方便查看历史
  farm_total_amount
  shared_amount

*/
contract Staking {
  // 合约所有者
  address onwer;

  // 用户质押 ICPDAO 的总数量
  uint256 user_staking_icpdao_total_amount;

  // 每个用户质押 ICPDAO 的数量
  mapping (address => uint256) user_staking_icpdao_amount;

  // 每个用户选择的分红列表
  // 额外说明：分红列表的总集合（发行的 dao token 的总集合）不在合约内记录，只在中心化web 服务中可以查询这个总集合
  mapping (address => address[]) user_select_token_list;

  // 每种分红 token 的信息
  struct PoolInfo {
    IERC20 token; // 矿池代表的 token 合约地址
    uint256 accTokenPerShare; // 每个 ICPDAO 代币应该得到的分红数量。

    uint256 user_staking_icpdao_amount; // 选择了这个分红的用户，他们的 icpdao 总质押数量

    // user address => reward_debt  用户不能得到的分红总数
    mapping (address => uint256) reward_debts;

    // 已经被 accTokenPerShare 计算过的数量
    uint256 shared_amount;

    // 被 token 合约 1% 转账过来的历史总数量
    uint256 farm_total_amount;

    // 最后一次分红完成时，token 的余额
    uint256 last_farm_balances_amount;
  }
  // token address => pool info
  mapping (address => uint256) pool_infos;


  constructor(
    address _onwer
  ) {
    // TODO
  }

  /*
  增加质押
  用户进行 ICPDAO 质押
  _amount 是质押 ICPDAO 的数量

  如果用户以前已经有质押，并且增加过分红token列表
  需要先结算一下分红，再增加
  权限：公开
  */
  function deposit(uint256 _amount) public {
    // TODO
  }

  /*
  带分红退出质押

  用户提取 ICPDAO 质押
  _amount 是提取 ICPDAO 的数量
  需要先结算一下分红，再退出

  权限：公开
  */
  function withdraw(uint256 _amount) public {
    // TODO
  }

  /*
    已经质押了 ICPDAO 的用户
    给自己的分红列表，增加 token 种类
  */
  function add_token(address[] _token_list) public {
    // TODO
  }


  /*
    已经质押了 ICPDAO 的用户
    给自己的分红列表，减少 token 种类
  */
  function remove_token(address[] _token_list) public {
    // TODO
  }


  /*
    已经质押了 ICPDAO 的用户 _user
    查看 _user 选中的分红列表
  */
  function view_token_list(address _user)
    public
    view
    returns (address[]){
    // TODO
  }

  // 计算截止到当前 msg.sneder 可以获取 _token_address_list 对应的 token 种类的分红
  function view_gain(address[] _token_address_list)
    external
    view
    returns (uint256[]){
    // TODO
  }

  // 提取自己在 _token_address_list 对应的 token 种类的分红
  function gain(address[] _token_address_list) public {
    // TODO
  }

}
