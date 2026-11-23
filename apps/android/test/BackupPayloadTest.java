package com.cardduel.solo;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

public final class BackupPayloadTest {
    private static void check(boolean value){if(!value)throw new AssertionError();}
    private static void rejected(byte[] bytes,int limit)throws Exception{
        try{BackupPayload.readUtf8(new ByteArrayInputStream(bytes),limit);throw new AssertionError("Accepted invalid input");}catch(IOException expected){}
    }
    public static void main(String[] ignored)throws Exception{
        check(BackupPayload.validRequest("1-2-3","open","",""));
        check(BackupPayload.validRequest("123","save","card-duel-growth-2026-11-22.json","{\"name\":\"한글 덱\"}"));
        check(!BackupPayload.validRequest("x","open","",""));
        check(!BackupPayload.validRequest("123","save","../anything.json","{}"));
        check(!BackupPayload.validRequest("123","open","other.json",""));
        check(!BackupPayload.validRequest("123","delete","",""));
        String korean="{\"name\":\"한글 카드\"}";
        byte[] bytes=korean.getBytes(StandardCharsets.UTF_8);
        check(korean.equals(BackupPayload.readUtf8(new ByteArrayInputStream(bytes),bytes.length)));
        rejected(bytes,bytes.length-1);rejected(new byte[]{(byte)0xc3,(byte)0x28},10);
        StringBuilder big=new StringBuilder();for(int i=0;i<BackupPayload.LIMIT/3+1;i++)big.append('한');
        check(!BackupPayload.validRequest("123","save","card-duel-decks-2026-11-22.json",big.toString()));
        System.out.println("Native Java backup payload checks passed");
    }
}
