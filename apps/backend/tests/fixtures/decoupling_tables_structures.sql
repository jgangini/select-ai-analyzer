SQL> desc FLEXCUBE.FLEX_ACTB_ACCBAL_HISTORY
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 BRANCH_CODE                               NOT NULL VARCHAR2(3)
 ACCOUNT                                   NOT NULL VARCHAR2(20)
 BKG_DATE                                  NOT NULL DATE
 ACC_CCY                                   NOT NULL VARCHAR2(3)
 ACY_CLOSING_BAL                                    NUMBER(24,3)
 LAST_UPD                                           DATE

SQL> desc FLEXCUBE.FLEX_EXT_ACCOUNT_TRANSACTIONS
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 TRN_REF_NO                                         VARCHAR2(17)
 TRN_DT                                             DATE
 ACCOUNT_NO                                         VARCHAR2(20)
 AMOUNT                                             NUMBER
 LCY_AMOUNT                                         NUMBER
 DRCR_IND                                           CHAR(1)
 PRODUCT_CODE                                       VARCHAR2(4)
 RELATED_CUSTOMER                                   VARCHAR2(12)
 TXN_ID                                             VARCHAR2(43)

SQL> desc FLEXCUBE.FLEX_ACTB_ACCBAL_HISTORY
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 BRANCH_CODE                               NOT NULL VARCHAR2(3)
 ACCOUNT                                   NOT NULL VARCHAR2(20)

SQL> desc FLEXCUBE.TDTM_RATE_DETAIL
ERROR:
ORA-04043: object FLEXCUBE.TDTM_RATE_DETAIL does not exist
