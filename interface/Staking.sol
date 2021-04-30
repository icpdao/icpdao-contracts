pragma solidity ^0.8.0;

contract Staking {
  // 合约所有者
  address onwer;

  // 目前的 分红 token 种类列表
  address[] token_address_list;

  mapping (address => uint256) user_staking_icpdao_amount;

  struct PoolInfo {
    IERC20 token; // 矿池代表的 token 合约地址
    uint256 accTokenPerShare; // 每个 token 代币应该得到的分红数量。

    // user address => reward_debt  用户不能得到的分红总数
    mapping (address => uint256) reward_debts;
  }
  // token address => pool info
  mapping (address => uint256) pool_infos;


  constructor(
    address _onwer
  ) {
    // TODO
  }

  /*
    挖矿

    调用者应该是：token 合约，在 token 合约的挖矿接口中调用这个接口

    这个接口做如下三件事情
    1. 记录质押合约目前持有的 token_address 这个种类 token 的 token 数量
    2. 因为是 token 合约调用的这个接口，所以可以在这个时候 转账 token 挖矿 的 1% token 给质押合约
    3. 记录转账后质押合约目前持有的 token_address 这个种类 token 的 token 数量
      如果新增数量等于 add_amount 说明是一个合法的调用
      这个涉及到 合约间接调用的设计，很多细节我还不太确定如何写
    4. 如果 token_address 不在 token_address_list 列表，就增加一下，并创建新的 PoolInfo
    5. 更新 PoolInfo 中的 accTokenPerShare
    权限：公开
  */
  function farm(address token_address, uint256 add_amount) public {
    // TODO
  }

  /*
    从分红 token 种类列表去掉 token_address
    权限：owner
  */
  function remove_token_address(address token_address) public {
    // TODO
  }

  /*
  增加质押

  用户进行 ICPDAO 质押，_amount 是质押 ICPDAO 的数量

  问题：如果用户以前已经有质押，需要先结算一下分红，结算分红需要遍历所有 token 种类 分红，可能是比较大的数组遍历

  权限：公开
  */
  function deposit(uint256 _amount) public {
    // TODO
  }

  /*
  带分红退出质押

  用户提取 ICPDAO 质押，_amount 是提取 ICPDAO 的数量

  问题：结算分红需要遍历所有 token 种类 分红，可能是比较大的数组遍历

  权限：公开
  */
  function withdraw(uint256 _amount) public {
    // TODO
  }

  /*
  放弃分红全部退出质押

  紧急情况下调用，用户放弃分红，提取全部 ICPDAO 质押

  权限：公开
  */
  function emergencyWithdraw() public {
    // TODO
  }

  // 计算截止到当前 _user 可以获取 _token_address 对应的 token 种类的分红
  function pending(address _user, address _token_address)
    external
    view
    returns (uint256){
    // TODO
  }

}
